/**
 * The dashboard sign-in part of the environment (lib/auth/). Secrets live only here —
 * whether a method is switched on is a settings file (data/auth-settings.json).
 */

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Requested at sign-in, space-separated in the request; always contains `openid`. */
  scopes: string[];
  /** The button on the sign-in page (`OIDC_DISPLAY_NAME`, default "SSO"). */
  displayName: string;
}

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface AuthEnvConfig {
  /** Signs the session cookie (`DASHBOARD_SESSION_SECRET`). */
  secret: string;
  oidc: OidcConfig | null;
  discord: OAuthClientConfig | null;
  github: OAuthClientConfig | null;
  /** The first admin, created once when no password account exists. */
  bootstrap: { username: string; password: string } | null;
}

// WHY a fixed secret outside production: a development stack should start without
// one. Production refuses to start without its own (below).
const DEVELOPMENT_SECRET = 'pipit-development-only-session-secret-not-for-production';

// WHY a setting: providers differ in what they release without being asked. Some
// only put `groups` into the token when that scope is requested, and the dashboard's
// admin check depends on it — so `groups` is in the default, and an operator whose
// provider names things differently can say so.
const DEFAULT_OIDC_SCOPES = ['openid', 'profile', 'email', 'groups'];

function value(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function parseOidcScopes(raw: string | undefined): string[] {
  const scopes = [...new Set((raw ?? '').split(/[\s,]+/).filter(Boolean))];
  if (scopes.length === 0) {
    return DEFAULT_OIDC_SCOPES;
  }

  if (!scopes.includes('openid')) {
    throw new Error('OIDC_SCOPES must include openid');
  }

  return scopes;
}

function parseOidc(): OidcConfig | null {
  const issuer = value('OIDC_ISSUER');
  if (!issuer) {
    return null;
  }

  const clientId = value('OIDC_CLIENT_ID');
  const clientSecret = value('OIDC_CLIENT_SECRET');
  if (!clientId) {
    throw new Error('OIDC_CLIENT_ID is required when OIDC_ISSUER is set');
  }
  if (!clientSecret) {
    throw new Error('OIDC_CLIENT_SECRET is required when OIDC_ISSUER is set');
  }

  return {
    issuer: issuer.endsWith('/') ? issuer : `${issuer}/`,
    clientId,
    clientSecret,
    scopes: parseOidcScopes(process.env.OIDC_SCOPES),
    displayName: value('OIDC_DISPLAY_NAME') ?? 'SSO',
  };
}

/** Both of a pair or neither: one alone is a typo, not a choice. */
function parsePair(idName: string, secretName: string): OAuthClientConfig | null {
  const clientId = value(idName);
  const clientSecret = value(secretName);
  if (!clientId && !clientSecret) {
    return null;
  }
  if (!clientId || !clientSecret) {
    throw new Error(`${idName} and ${secretName} are set together, or not at all`);
  }

  return { clientId, clientSecret };
}

export function parseAuthEnv(nodeEnv: string): AuthEnvConfig {
  let secret = value('DASHBOARD_SESSION_SECRET');
  if (!secret) {
    if (nodeEnv === 'production') {
      throw new Error('DASHBOARD_SESSION_SECRET is required in production');
    }
    secret = DEVELOPMENT_SECRET;
  }

  const bootstrap = parsePair('DASHBOARD_BOOTSTRAP_USERNAME', 'DASHBOARD_BOOTSTRAP_PASSWORD');
  return {
    secret,
    oidc: parseOidc(),
    discord: parsePair('DISCORD_OAUTH_CLIENT_ID', 'DISCORD_OAUTH_CLIENT_SECRET'),
    github: parsePair('GITHUB_OAUTH_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_SECRET'),
    bootstrap: bootstrap
      ? { username: bootstrap.clientId, password: bootstrap.clientSecret }
      : null,
  };
}

/** Variables that no longer do anything, said once at start (lib/auth/start.ts). */
export function retiredAuthVariables(): string[] {
  return ['DASHBOARD_DEV_USER', 'DASHBOARD_DEV_ROLE', 'OIDC_REDIRECT_URI'].filter((name) =>
    value(name),
  );
}
