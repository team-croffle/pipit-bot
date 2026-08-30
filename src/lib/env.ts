import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { setup } from '@skyra/env-utilities';

import { rootDir } from './constants.js';

export type DashboardDevRole = 'viewer' | 'admin';

export interface GithubAppConfig {
  appId: string;
  /** PEM. Accepted base64-encoded too, since a PEM does not survive every .env. */
  privateKey: string;
  /** null asks the API which installation this is, and remembers the answer. */
  installationId: number | null;
}

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionSecret: string;
}

export interface EnvConfig {
  botToken: string;
  streamRoot: string;
  musicWorkerUrl: string;
  pipitApiUrl: string;
  apiPort: number;
  internalToken: string;
  githubWebhookSecret: string | null;
  githubApp: GithubAppConfig | null;
  dashboardAdminGroups: string[];
  dashboardDevUser: string;
  dashboardDevRole: DashboardDevRole;
  oidc: OidcConfig | null;
  nodeEnv: string;
}

function parsePort(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid port value: ${raw}`);
  }

  return value;
}

function parseGroupList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw?.trim()) {
    return fallback;
  }

  return raw
    .split(',')
    .map((group) => group.trim())
    .filter((group) => group.length > 0);
}

function parseDashboardDevRole(raw: string | undefined): DashboardDevRole {
  const value = (raw ?? 'admin').toLowerCase();
  if (value === 'viewer' || value === 'admin') {
    return value;
  }

  throw new Error(`Invalid DASHBOARD_DEV_ROLE="${raw}". Expected "viewer" or "admin".`);
}

/**
 * Reads the App credentials used to list repositories and organisation members.
 *
 * WHY it returns null instead of throwing when unset: this only feeds two dashboard
 * pickers. A bot that cannot reach the API still receives webhooks and still posts
 * reminders, so a missing credential disables a convenience, not the feature.
 */
/**
 * Reads the App private key from a file or from the environment.
 *
 * WHY the path wins: a PEM is multi-line, which `.env` carries badly, and a secret
 * mounted as a file is the usual shape in a container. When both are set the file is
 * the more deliberate of the two, so it decides.
 */
function readPrivateKey(): string | null {
  const path = process.env.GITHUB_APP_PRIVATE_KEY_PATH?.trim();
  if (path) {
    try {
      return readFileSync(path, 'utf8').trim();
    } catch {
      throw new Error(`GITHUB_APP_PRIVATE_KEY_PATH is set but ${path} could not be read`);
    }
  }

  const raw = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  if (!raw) {
    return null;
  }

  // An escaped-newline PEM survives .env; a base64 one avoids the question entirely.
  return raw.includes('BEGIN')
    ? raw.replaceAll(String.raw`\n`, '\n')
    : Buffer.from(raw, 'base64').toString('utf8');
}

function parseGithubApp(): GithubAppConfig | null {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const privateKey = readPrivateKey();
  if (!appId || !privateKey) {
    return null;
  }

  if (!privateKey.includes('BEGIN')) {
    throw new Error(
      'The GitHub App private key must be a PEM — set GITHUB_APP_PRIVATE_KEY_PATH to a file, or GITHUB_APP_PRIVATE_KEY to the PEM itself (raw or base64-encoded)',
    );
  }

  const rawInstallation = process.env.GITHUB_APP_INSTALLATION_ID?.trim();
  if (rawInstallation && !/^\d+$/.test(rawInstallation)) {
    throw new Error('GITHUB_APP_INSTALLATION_ID must be a number');
  }

  return {
    appId,
    privateKey,
    installationId: rawInstallation ? Number(rawInstallation) : null,
  };
}

function parseOidc(nodeEnv: string): OidcConfig | null {
  const issuer = process.env.OIDC_ISSUER?.trim();
  if (!issuer) {
    return null;
  }

  const normalizedIssuer = issuer.endsWith('/') ? issuer : `${issuer}/`;

  const clientId = process.env.OIDC_CLIENT_ID?.trim();
  const clientSecret = process.env.OIDC_CLIENT_SECRET?.trim();
  const redirectUri = process.env.OIDC_REDIRECT_URI?.trim();
  const sessionSecret = process.env.DASHBOARD_SESSION_SECRET?.trim();

  if (!clientId) {
    throw new Error('OIDC_CLIENT_ID is required when OIDC_ISSUER is set');
  }
  if (!clientSecret) {
    throw new Error('OIDC_CLIENT_SECRET is required when OIDC_ISSUER is set');
  }
  if (!redirectUri) {
    throw new Error('OIDC_REDIRECT_URI is required when OIDC_ISSUER is set');
  }
  if (!sessionSecret) {
    if (nodeEnv === 'production') {
      throw new Error('DASHBOARD_SESSION_SECRET is required when OIDC is enabled in production');
    }
    throw new Error('DASHBOARD_SESSION_SECRET is required when OIDC_ISSUER is set');
  }

  return { issuer: normalizedIssuer, clientId, clientSecret, redirectUri, sessionSecret };
}

export function loadEnv(): EnvConfig {
  setup({ path: join(rootDir, '.env') });

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    throw new Error('BOT_TOKEN is required');
  }

  const streamRoot = process.env.STREAM_ROOT;
  if (!streamRoot) {
    throw new Error('STREAM_ROOT is required');
  }

  const musicWorkerUrl = process.env.MUSIC_WORKER_URL;
  if (!musicWorkerUrl) {
    throw new Error('MUSIC_WORKER_URL is required');
  }

  const internalToken = process.env.INTERNAL_TOKEN;
  if (!internalToken) {
    throw new Error('INTERNAL_TOKEN is required');
  }

  const apiPort = parsePort(process.env.API_PORT, 3000);
  const pipitApiUrl = (process.env.PIPIT_API_URL ?? `http://127.0.0.1:${apiPort}`).replace(
    /\/$/,
    '',
  );

  const nodeEnv = process.env.NODE_ENV ?? 'development';

  return {
    botToken,
    streamRoot,
    musicWorkerUrl: musicWorkerUrl.replace(/\/$/, ''),
    pipitApiUrl,
    apiPort,
    internalToken,
    githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET?.trim() || null,
    githubApp: parseGithubApp(),
    dashboardAdminGroups: parseGroupList(process.env.DASHBOARD_ADMIN_GROUPS, ['pipit-admins']),
    dashboardDevUser: process.env.DASHBOARD_DEV_USER?.trim() || 'dev',
    dashboardDevRole: parseDashboardDevRole(process.env.DASHBOARD_DEV_ROLE),
    oidc: parseOidc(nodeEnv),
    nodeEnv,
  };
}

let cached: EnvConfig | undefined;

export function getEnv(): EnvConfig {
  if (!cached) {
    cached = loadEnv();
  }

  return cached;
}

declare module '@sapphire/pieces' {
  interface Container {
    config: EnvConfig;
  }
}
