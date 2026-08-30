import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { dataDir } from '../constants.js';
import { defaultTemplateFor, LEGACY_DEFAULT_TEMPLATE } from './default-templates.js';
import { parseEmbedTemplate, parseEmbedTemplateMap, type EmbedTemplate } from './embed-template.js';
import { EVENT_VARIABLES } from './template.js';

export interface GithubEventToggles {
  pullRequestOpened: boolean;
  pullRequestUpdated: boolean;
  pullRequestAssigned: boolean;
  pullRequestChangesRequested: boolean;
  pullRequestApproved: boolean;
  pullRequestMerged: boolean;
  issueOpened: boolean;
  issueAssigned: boolean;
  /** Closed as completed. */
  issueResolved: boolean;
  /** Closed as not planned or duplicate. */
  issueClosed: boolean;
  issueReopened: boolean;
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

/** A missing key means "use the built-in default for that event". */
export type GithubEventTemplates = Partial<Record<keyof GithubEventToggles, EmbedTemplate>>;

// WHY: The webhook secret stays in env — a dashboard GET must never echo it back.
export interface GithubNotifySettings {
  enabled: boolean;
  channelId: string | null;
  events: GithubEventToggles;
  /** Per-event wording; every event falls back to its own built-in default. */
  eventTemplates: GithubEventTemplates;
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

// Ordered the way the dashboard lists them: a pull request's life, then an issue's.
export const TOGGLE_KEYS = [
  'pullRequestOpened',
  'pullRequestUpdated',
  'pullRequestAssigned',
  'pullRequestChangesRequested',
  'pullRequestApproved',
  'pullRequestMerged',
  'issueOpened',
  'issueAssigned',
  'issueResolved',
  'issueClosed',
  'issueReopened',
  'commentCreated',
] as const satisfies readonly (keyof GithubEventToggles)[];

// v0.6.4-rc.2 and earlier had one toggle for every review outcome. Both halves
// inherit it, so somebody who had review notifications on does not quietly lose them.
const SPLIT_FROM_REVIEW_SUBMITTED = [
  'pullRequestChangesRequested',
  'pullRequestApproved',
] as const satisfies readonly (keyof GithubEventToggles)[];

function emptyToggles(): GithubEventToggles {
  return {
    pullRequestOpened: false,
    pullRequestUpdated: false,
    pullRequestAssigned: false,
    pullRequestChangesRequested: false,
    pullRequestApproved: false,
    pullRequestMerged: false,
    issueOpened: false,
    issueAssigned: false,
    issueResolved: false,
    issueClosed: false,
    issueReopened: false,
    commentCreated: false,
  };
}

function emptySettings(): GithubNotifySettings {
  return {
    enabled: false,
    channelId: null,
    events: emptyToggles(),
    eventTemplates: {},
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

  if (row.reviewSubmitted === true) {
    for (const key of SPLIT_FROM_REVIEW_SUBMITTED) {
      toggles[key] = true;
    }
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

/**
 * Carries a v0.6.2 file forward.
 *
 * That version stored one `template` string shared by every event, with per-event
 * strings overriding it. Wording is now per-event, so a base the operator actually
 * customised is copied onto every event that has no override of its own — dropping
 * it would silently reset their wording. A base still equal to the old built-in
 * default is left behind so the file picks up the new per-event defaults instead.
 */
function migrateLegacyBase(body: Record<string, unknown>, templates: GithubEventTemplates): void {
  const base = body.template;
  if (typeof base !== 'string' || base.trim() === '' || base === LEGACY_DEFAULT_TEMPLATE) {
    return;
  }

  for (const key of TOGGLE_KEYS) {
    templates[key] ??= parseEmbedTemplate(base, `Template for ${key}`, EVENT_VARIABLES[key]);
  }
}

/**
 * Wording written for the single review event follows it into both halves, for the
 * same reason the toggle does — an operator who customised it should not find the
 * default back in its place.
 */
function migrateSplitReview(body: Record<string, unknown>, templates: GithubEventTemplates): void {
  const map = body.eventTemplates;
  if (!map || typeof map !== 'object') {
    return;
  }

  const stored = (map as Record<string, unknown>).reviewSubmitted;
  if (stored === null || stored === undefined) {
    return;
  }

  for (const key of SPLIT_FROM_REVIEW_SUBMITTED) {
    templates[key] ??= parseEmbedTemplate(stored, `Template for ${key}`, EVENT_VARIABLES[key]);
  }
}

export function parseGithubNotifySettings(raw: unknown): GithubNotifySettings {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Settings must be an object');
  }

  const body = raw as Record<string, unknown>;
  const eventTemplates = parseEmbedTemplateMap(body.eventTemplates, TOGGLE_KEYS);
  migrateSplitReview(body, eventTemplates);
  migrateLegacyBase(body, eventTemplates);

  return {
    enabled: body.enabled === true,
    channelId: asChannelId(body.channelId, 'channelId'),
    events: asToggles(body.events),
    eventTemplates,
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

/** The wording for one event: its own override, else that event's built-in default. */
export function resolveTemplate(
  settings: GithubNotifySettings,
  toggle: keyof GithubEventToggles,
): EmbedTemplate {
  return settings.eventTemplates[toggle] ?? defaultTemplateFor(toggle);
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
