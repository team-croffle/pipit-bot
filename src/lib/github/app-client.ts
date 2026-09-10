/**
 * Reads the GitHub App's own installation.
 *
 * WHY no Octokit: this needs one RS256 JWT and three GETs. `node:crypto` signs the
 * assertion and `fetch` does the rest, which is a smaller surface than a dependency
 * whose plugin graph dwarfs the code that would use it.
 *
 * WHY the App rather than a personal token: the webhook already arrives through this
 * App, so the credential stays in one place, and "the repositories it is installed
 * on" is exactly the list the dashboard wants to offer.
 */

import { createSign } from 'node:crypto';

import { container } from '@sapphire/framework';

import type { GithubAppConfig } from '../env.js';

const API = 'https://api.github.com';
const ACCEPT = 'application/vnd.github+json';
const JWT_TTL_SECONDS = 540;
// Renewed early: an installation token lasts an hour, and a request that starts just
// before the boundary must not finish just after it.
const TOKEN_MARGIN_MS = 60_000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_PAGES = 4;
const PER_PAGE = 100;

export interface GithubRepositoryOption {
  fullName: string;
  private: boolean;
}

export interface GithubMemberOption {
  login: string;
  avatarUrl: string;
}

/** Where the account list came from, so the dashboard can say why it looks as it does. */
export type GithubMemberSource = 'organization' | 'assignees' | 'none';

export interface GithubMemberList {
  members: GithubMemberOption[];
  source: GithubMemberSource;
}

// Enough for a team's installation; a bound so a large one cannot turn one dashboard
// request into hundreds of API calls.
const MAX_ASSIGNEE_REPOSITORIES = 20;

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

/** The App's own assertion — proves who is asking, not what it may read. */
function createAppJwt(config: GithubAppConfig, now: number): string {
  const issued = Math.floor(now / 1000) - 30;
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({ iat: issued, exp: issued + JWT_TTL_SECONDS, iss: config.appId }),
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();

  return `${header}.${payload}.${signer.sign(config.privateKey, 'base64url')}`;
}

async function callGithub<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      accept: ACCEPT,
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub responded ${response.status} for ${path}`);
  }

  return (await response.json()) as T;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | undefined;
let cachedInstallationId: number | undefined;

async function resolveInstallationId(config: GithubAppConfig, jwt: string): Promise<number> {
  if (config.installationId !== null) {
    return config.installationId;
  }

  if (cachedInstallationId !== undefined) {
    return cachedInstallationId;
  }

  const installations = await callGithub<{ id: number }[]>('/app/installations', jwt);
  const first = installations[0];
  if (!first) {
    throw new Error('The GitHub App is not installed anywhere');
  }

  cachedInstallationId = first.id;
  return first.id;
}

async function getInstallationToken(config: GithubAppConfig): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - TOKEN_MARGIN_MS > now) {
    return cachedToken.token;
  }

  const jwt = createAppJwt(config, now);
  const installationId = await resolveInstallationId(config, jwt);
  const response = await fetch(`${API}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      accept: ACCEPT,
      authorization: `Bearer ${jwt}`,
      'x-github-api-version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub refused an installation token (${response.status})`);
  }

  const body = (await response.json()) as { token: string; expires_at: string };
  cachedToken = { token: body.token, expiresAt: Date.parse(body.expires_at) };
  return body.token;
}

async function paginate<T>(path: string, token: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const batch = await callGithub<T[]>(
      `${path}${separator}per_page=${PER_PAGE}&page=${page}`,
      token,
    );
    items.push(...batch);
    if (batch.length < PER_PAGE) {
      break;
    }
  }

  return items;
}

interface Cached<T> {
  value: T;
  at: number;
}

let repositoryCache: Cached<GithubRepositoryOption[]> | undefined;
let memberCache: Cached<GithubMemberList> | undefined;

function fresh<T>(cache: Cached<T> | undefined): T | undefined {
  return cache && Date.now() - cache.at < CACHE_TTL_MS ? cache.value : undefined;
}

export async function listInstallationRepositories(
  config: GithubAppConfig,
): Promise<GithubRepositoryOption[]> {
  const cached = fresh(repositoryCache);
  if (cached) {
    return cached;
  }

  const token = await getInstallationToken(config);
  // This endpoint wraps its page in `{ total_count, repositories }`, which is why it
  // could not share paginate() and went without paging until rc.8.
  const collected: { full_name: string; private: boolean }[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const body = await callGithub<{ repositories: { full_name: string; private: boolean }[] }>(
      `/installation/repositories?per_page=${PER_PAGE}&page=${page}`,
      token,
    );
    collected.push(...body.repositories);
    if (body.repositories.length < PER_PAGE) {
      break;
    }
  }

  const repositories = collected
    .map((repository) => ({ fullName: repository.full_name, private: repository.private }))
    .toSorted((a, b) => a.fullName.localeCompare(b.fullName));

  repositoryCache = { value: repositories, at: Date.now() };
  return repositories;
}

interface GithubPerson {
  login: string;
  avatar_url: string;
}

/** Reads one list of people into the map, and says whether it added anybody. */
async function collect(
  path: string,
  token: string,
  into: Map<string, GithubMemberOption>,
): Promise<void> {
  const people = await paginate<GithubPerson>(path, token);
  for (const person of people) {
    into.set(person.login.toLowerCase(), { login: person.login, avatarUrl: person.avatar_url });
  }
}

/**
 * The people who could appear in an account mapping.
 *
 * First choice is the members of the organisations that own the installed
 * repositories. That endpoint answers only when the App was granted Organization ›
 * Members (read) — a permission the installer has to approve, and one this list was
 * silently empty without for two release candidates.
 *
 * When that yields nobody, each installed repository's assignable users are read
 * instead. Repository metadata is enough for that, and "who can be assigned" is
 * exactly the set a mapping is about. An organisation or repository the App may not
 * read is skipped rather than failing the request: a partial list is still a better
 * picker than a blank text box. The source is returned so the dashboard can say which
 * one it is looking at, or why there is none.
 */
export async function listInstallationMembers(config: GithubAppConfig): Promise<GithubMemberList> {
  const cached = fresh(memberCache);
  if (cached) {
    return cached;
  }

  const token = await getInstallationToken(config);
  const repositories = await listInstallationRepositories(config);
  const owners = [
    ...new Set(repositories.map((repository) => repository.fullName.split('/')[0] ?? '')),
  ].filter(Boolean);

  const members = new Map<string, GithubMemberOption>();
  for (const owner of owners) {
    try {
      await collect(`/orgs/${owner}/members`, token, members);
    } catch (error) {
      container.logger.debug(`[github] no member list for ${owner}:`, error);
    }
  }

  let source: GithubMemberSource = members.size > 0 ? 'organization' : 'none';
  if (members.size === 0) {
    for (const repository of repositories.slice(0, MAX_ASSIGNEE_REPOSITORIES)) {
      try {
        await collect(`/repos/${repository.fullName}/assignees`, token, members);
      } catch (error) {
        container.logger.debug(`[github] no assignee list for ${repository.fullName}:`, error);
      }
    }
    source = members.size > 0 ? 'assignees' : 'none';
  }

  const list: GithubMemberList = {
    members: [...members.values()].toSorted((a, b) => a.login.localeCompare(b.login)),
    source,
  };
  memberCache = { value: list, at: Date.now() };
  return list;
}
