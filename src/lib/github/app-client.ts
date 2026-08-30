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
let memberCache: Cached<GithubMemberOption[]> | undefined;

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
  const body = await callGithub<{ repositories: { full_name: string; private: boolean }[] }>(
    `/installation/repositories?per_page=${PER_PAGE}`,
    token,
  );

  const repositories = body.repositories
    .map((repository) => ({ fullName: repository.full_name, private: repository.private }))
    .toSorted((a, b) => a.fullName.localeCompare(b.fullName));

  repositoryCache = { value: repositories, at: Date.now() };
  return repositories;
}

/**
 * The people who could appear in an account mapping.
 *
 * Collected from the organisations that own the installed repositories, because that
 * is the set the App can see without asking for a second scope. A repository owned by
 * a user account has no member list, so it contributes nothing — and an organisation
 * the App may not read members of is skipped rather than failing the whole request,
 * since a partial list is still a better picker than a blank text box.
 */
export async function listInstallationMembers(
  config: GithubAppConfig,
): Promise<GithubMemberOption[]> {
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
      const people = await paginate<{ login: string; avatar_url: string }>(
        `/orgs/${owner}/members`,
        token,
      );
      for (const person of people) {
        members.set(person.login.toLowerCase(), {
          login: person.login,
          avatarUrl: person.avatar_url,
        });
      }
    } catch (error) {
      container.logger.debug(`[github] no member list for ${owner}:`, error);
    }
  }

  const sorted = [...members.values()].toSorted((a, b) => a.login.localeCompare(b.login));
  memberCache = { value: sorted, at: Date.now() };
  return sorted;
}
