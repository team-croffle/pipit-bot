import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { dataDir } from '../constants.js';

export interface GithubEventToggles {
  pullRequestOpened: boolean;
  pullRequestMerged: boolean;
  pullRequestAssigned: boolean;
  issueOpened: boolean;
  issueAssigned: boolean;
  reviewSubmitted: boolean;
  commentCreated: boolean;
}

/** `null` on a field means "inherit the global default". */
export interface GithubRepoRule {
  repo: string;
  channelId: string | null;
  events: GithubEventToggles | null;
}

export interface GithubAccountMapping {
  githubLogin: string;
  discordUserId: string;
}

// WHY: The webhook secret stays in env — a dashboard GET must never echo it back.
export interface GithubNotifySettings {
  enabled: boolean;
  channelId: string | null;
  events: GithubEventToggles;
  repos: GithubRepoRule[];
  accounts: GithubAccountMapping[];
}

export interface ResolvedRepoRule {
  channelId: string;
  events: GithubEventToggles;
}

const settingsPath = join(dataDir, 'github-notify.json');
const snowflake = /^\d{17,20}$/;
const repoName = /^[\w.-]{1,100}\/[\w.-]{1,100}$/;
// WHY: The real GitHub username grammar. Also a security control — it makes a login
// like `everyone`, or one carrying backticks/`<`/`@`, impossible to persist.
const githubLogin = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

const TOGGLE_KEYS = [
  'pullRequestOpened',
  'pullRequestMerged',
  'pullRequestAssigned',
  'issueOpened',
  'issueAssigned',
  'reviewSubmitted',
  'commentCreated',
] as const satisfies readonly (keyof GithubEventToggles)[];

function emptyToggles(): GithubEventToggles {
  return {
    pullRequestOpened: false,
    pullRequestMerged: false,
    pullRequestAssigned: false,
    issueOpened: false,
    issueAssigned: false,
    reviewSubmitted: false,
    commentCreated: false,
  };
}

function emptySettings(): GithubNotifySettings {
  return {
    enabled: false,
    channelId: null,
    events: emptyToggles(),
    repos: [],
    accounts: [],
  };
}

let cache: GithubNotifySettings | undefined;

function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && snowflake.test(value);
}

function asChannelId(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (!isSnowflake(value)) {
    throw new Error(`${label} must be a snowflake or null`);
  }

  return value;
}

function asToggles(value: unknown): GithubEventToggles {
  if (value === null || value === undefined) {
    return emptyToggles();
  }

  if (typeof value !== 'object') {
    throw new Error('events must be an object');
  }

  const row = value as Record<string, unknown>;
  const toggles = emptyToggles();
  for (const key of TOGGLE_KEYS) {
    toggles[key] = row[key] === true;
  }

  return toggles;
}

function asRepoRules(value: unknown): GithubRepoRule[] {
  if (!Array.isArray(value)) {
    throw new Error('repos must be an array');
  }

  const rules: GithubRepoRule[] = [];
  const seen = new Set<string>();
  for (const item of value.slice(0, 50)) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid repository rule');
    }

    const row = item as Record<string, unknown>;
    const repo = typeof row.repo === 'string' ? row.repo.trim().toLowerCase() : '';
    if (!repoName.test(repo)) {
      throw new Error('Each repository must be in owner/name form');
    }

    if (seen.has(repo)) {
      throw new Error(`Duplicate repository: ${repo}`);
    }

    seen.add(repo);
    rules.push({
      repo,
      channelId: asChannelId(row.channelId, 'Repository channelId'),
      events: row.events === null || row.events === undefined ? null : asToggles(row.events),
    });
  }

  return rules;
}

function asAccountMappings(value: unknown): GithubAccountMapping[] {
  if (!Array.isArray(value)) {
    throw new Error('accounts must be an array');
  }

  const accounts: GithubAccountMapping[] = [];
  const seen = new Set<string>();
  for (const item of value.slice(0, 200)) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid account mapping');
    }

    const row = item as Record<string, unknown>;
    const login = typeof row.githubLogin === 'string' ? row.githubLogin.trim().toLowerCase() : '';
    if (!githubLogin.test(login)) {
      throw new Error('Each account needs a valid GitHub login');
    }

    if (seen.has(login)) {
      throw new Error(`Duplicate GitHub login: ${login}`);
    }

    if (!isSnowflake(row.discordUserId)) {
      throw new Error('Each account needs a Discord user id');
    }

    seen.add(login);
    accounts.push({ githubLogin: login, discordUserId: row.discordUserId });
  }

  return accounts;
}

export function parseGithubNotifySettings(raw: unknown): GithubNotifySettings {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Settings must be an object');
  }

  const body = raw as Record<string, unknown>;

  return {
    enabled: body.enabled === true,
    channelId: asChannelId(body.channelId, 'channelId'),
    events: asToggles(body.events),
    repos: asRepoRules(body.repos ?? []),
    accounts: asAccountMappings(body.accounts ?? []),
  };
}

export function getGithubNotifySettings(): GithubNotifySettings {
  return cache ?? emptySettings();
}

/**
 * Resolves where a repository's events go, applying the global defaults for any
 * field the repository rule leaves as `null`. Returns undefined when there is no
 * channel to post into.
 */
export function resolveRepoRule(
  settings: GithubNotifySettings,
  repo: string,
): ResolvedRepoRule | undefined {
  const rule = settings.repos.find((item) => item.repo === repo.toLowerCase());
  const channelId = rule?.channelId ?? settings.channelId;
  if (!channelId) {
    return undefined;
  }

  return { channelId, events: rule?.events ?? settings.events };
}

export async function loadGithubNotifySettings(): Promise<GithubNotifySettings> {
  try {
    cache = parseGithubNotifySettings(JSON.parse(await readFile(settingsPath, 'utf8')) as unknown);
  } catch {
    cache = emptySettings();
  }

  return getGithubNotifySettings();
}

export async function saveGithubNotifySettings(
  next: GithubNotifySettings,
): Promise<GithubNotifySettings> {
  const parsed = parseGithubNotifySettings(next);
  await mkdir(dataDir, { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  cache = parsed;
  return parsed;
}
