import { join } from 'node:path';

import { setup } from '@skyra/env-utilities';

import { rootDir } from './constants.js';

export type BotRole = 'main' | 'edge';

export type DashboardDevRole = 'viewer' | 'admin';

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionSecret: string;
}

export interface EnvConfig {
  botToken: string;
  role: BotRole;
  streamRoot: string;
  musicWorkerUrl: string;
  pipitApiUrl: string;
  apiPort: number;
  internalToken: string;
  dashboardAdminGroups: string[];
  dashboardDevUser: string;
  dashboardDevRole: DashboardDevRole;
  oidc: OidcConfig | null;
  nodeEnv: string;
  isMain: boolean;
  isEdge: boolean;
}

function parseRole(raw: string | undefined): BotRole {
  const value = (raw ?? 'main').toLowerCase();
  if (value === 'main' || value === 'edge') {
    return value;
  }

  throw new Error(`Invalid ROLE="${raw}". Expected "main" or "edge".`);
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

  const role = parseRole(process.env.ROLE);
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  return {
    botToken,
    role,
    streamRoot,
    musicWorkerUrl: musicWorkerUrl.replace(/\/$/, ''),
    pipitApiUrl,
    apiPort,
    internalToken,
    dashboardAdminGroups: parseGroupList(process.env.DASHBOARD_ADMIN_GROUPS, ['pipit-admins']),
    dashboardDevUser: process.env.DASHBOARD_DEV_USER?.trim() || 'dev',
    dashboardDevRole: parseDashboardDevRole(process.env.DASHBOARD_DEV_ROLE),
    oidc: parseOidc(nodeEnv),
    nodeEnv,
    isMain: role === 'main',
    isEdge: role === 'edge',
  };
}

let cached: EnvConfig | undefined;

export function getEnv(): EnvConfig {
  if (!cached) {
    cached = loadEnv();
  }

  return cached;
}

export function setEnvConfig(config: EnvConfig): void {
  cached = config;
}

declare module '@sapphire/pieces' {
  interface Container {
    config: EnvConfig;
  }
}
