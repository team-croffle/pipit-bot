import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { container } from '@sapphire/framework';

import { dataDir } from '../constants.js';
import type { AuthEnvConfig } from '../env-auth.js';
import { loadSettingsFile } from '../settings-file.js';

/**
 * Which sign-in methods are switched on (`data/auth-settings.json`).
 *
 * WHY a file and not the database: a wrong sign-in setting locks everyone out of the
 * dashboard, and the way back is to open this file in an editor and restart
 * (docs/decisions/024_v0.8.0_database.md). For the same reason a damaged file, or one with
 * every method off, is not obeyed: the bot starts with every method the environment
 * configures and says so in the log.
 *
 * A method needs its environment to be switched on (OIDC its issuer and client, Discord
 * and GitHub their OAuth client); the password method needs nothing. At least one method
 * is always on — the save that would switch off the last one is refused.
 */

export const AUTH_METHODS = ['password', 'oidc', 'discord', 'github'] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];
export type AuthMethodSwitches = Record<AuthMethod, boolean>;

export interface AuthMethodState {
  method: AuthMethod;
  /** What the file says (or the default). */
  enabled: boolean;
  /** The environment has what the method needs. */
  available: boolean;
  /** Enabled and available: the sign-in page offers it. */
  active: boolean;
  /** Why it cannot be switched on, when it cannot. */
  unavailableReason: string | null;
}

let filePath = join(dataDir, 'auth-settings.json');
let switches: AuthMethodSwitches = { password: true, oidc: true, discord: true, github: true };
let fallback = false;
let env: AuthEnvConfig | undefined;

const REASONS: Record<AuthMethod, string | null> = {
  password: null,
  oidc: 'Set OIDC_ISSUER, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET to use it.',
  discord: 'Set DISCORD_OAUTH_CLIENT_ID and DISCORD_OAUTH_CLIENT_SECRET to use it.',
  github: 'Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET to use it.',
};

function isAvailable(method: AuthMethod): boolean {
  switch (method) {
    case 'password':
      return true;
    case 'oidc':
      return Boolean(env?.oidc);
    case 'discord':
      return Boolean(env?.discord);
    case 'github':
      return Boolean(env?.github);
  }
}

function parse(raw: unknown): AuthMethodSwitches {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Expected an object');
  }

  const record = raw as Record<string, unknown>;
  const next = { ...defaults() };
  for (const method of AUTH_METHODS) {
    if (record[method] !== undefined) {
      if (typeof record[method] !== 'boolean') {
        throw new Error(`${method} must be true or false`);
      }
      next[method] = record[method];
    }
  }
  return next;
}

/** Every method on: what is not configured is simply not offered. */
function defaults(): AuthMethodSwitches {
  return { password: true, oidc: true, discord: true, github: true };
}

function anyActive(next: AuthMethodSwitches): boolean {
  return AUTH_METHODS.some((method) => next[method] && isAvailable(method));
}

export async function loadAuthMethods(config: AuthEnvConfig): Promise<AuthMethodSwitches> {
  env = config;
  const loaded = await loadSettingsFile({
    path: filePath,
    label: 'Sign-in settings',
    parse,
    empty: defaults,
  });
  switches = loaded.value;
  fallback = Boolean(loaded.error) || !anyActive(switches);
  if (fallback) {
    switches = defaults();
    container.logger.warn(
      `[auth] ${loaded.error ? 'auth-settings.json could not be used' : 'auth-settings.json switches every sign-in method off'} — starting with every configured method on`,
    );
  }
  return switches;
}

export function isMethodActive(method: AuthMethod): boolean {
  return switches[method] && isAvailable(method);
}

export function getAuthMethodStates(): AuthMethodState[] {
  return AUTH_METHODS.map((method) => ({
    method,
    enabled: switches[method],
    available: isAvailable(method),
    active: isMethodActive(method),
    unavailableReason: isAvailable(method) ? null : REASONS[method],
  }));
}

/** The file was ignored at start (damaged, or everything off). */
export function isAuthMethodsFallback(): boolean {
  return fallback;
}

/** Validates and saves a change; refuses switching on what is not configured, or the last one off. */
export async function saveAuthMethods(change: unknown): Promise<AuthMethodState[]> {
  const next = parse({ ...switches, ...(change as object) });
  for (const method of AUTH_METHODS) {
    if (next[method] && !switches[method] && !isAvailable(method)) {
      throw new Error(`${method} cannot be switched on: ${REASONS[method]}`);
    }
  }
  if (!anyActive(next)) {
    throw new Error('At least one sign-in method must stay on.');
  }

  await mkdir(dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(temporary, filePath);
  switches = next;
  fallback = false;
  return getAuthMethodStates();
}

/** Points the settings at another file — for local checks only. */
export function setAuthMethodsPathForChecks(path: string): void {
  filePath = path;
}
