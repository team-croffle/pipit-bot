import * as client from 'openid-client';

import type { EnvConfig, OidcConfig } from '../../lib/env.js';

let cachedConfig: client.Configuration | undefined;

/**
 * Discovery against the issuer failed — DNS, TCP, TLS, a non-2xx or a malformed
 * document. The routes answer this differently from a bad code or state, so it
 * carries its own class rather than being inferred from a message.
 */
export class OidcDiscoveryError extends Error {
  public constructor(issuer: string, cause: unknown) {
    super(`OIDC discovery failed for ${issuer}`, { cause });
    this.name = 'OidcDiscoveryError';
  }
}

/** The innermost message of an error chain, e.g. `getaddrinfo ENOTFOUND host`. */
export function describeErrorCause(error: unknown): string {
  let current: unknown = error;
  let message = current instanceof Error ? current.message : String(current);
  while (current instanceof Error && current.cause !== undefined) {
    current = current.cause;
    message = current instanceof Error ? current.message : String(current);
  }

  return message;
}

export async function getOidcConfiguration(config: EnvConfig): Promise<client.Configuration> {
  if (!config.oidc) {
    throw new Error('OIDC is not configured');
  }

  // A failed discovery is not cached, so the next request retries the issuer.
  if (!cachedConfig) {
    try {
      cachedConfig = await client.discovery(
        new URL(config.oidc.issuer),
        config.oidc.clientId,
        config.oidc.clientSecret,
      );
    } catch (error) {
      throw new OidcDiscoveryError(config.oidc.issuer, error);
    }
  }

  return cachedConfig;
}

export function extractUsername(claims: Record<string, unknown>): string {
  for (const key of ['preferred_username', 'nickname', 'email', 'name', 'sub']) {
    const value = claims[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return 'user';
}

export function extractGroups(claims: Record<string, unknown>): string[] {
  const raw = claims.groups ?? claims.ak_groups ?? claims.group;
  if (Array.isArray(raw)) {
    return raw.filter((group): group is string => typeof group === 'string' && group.length > 0);
  }

  if (typeof raw === 'string') {
    return raw
      .split(/[|,]/)
      .map((group) => group.trim())
      .filter((group) => group.length > 0);
  }

  return [];
}

export async function buildLoginRedirect(config: EnvConfig): Promise<{
  redirectTo: URL;
  state: string;
  codeVerifier: string;
}> {
  const oidcConfig = await getOidcConfiguration(config);
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();

  const parameters: Record<string, string> = {
    redirect_uri: config.oidc!.redirectUri,
    scope: 'openid profile email groups',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  };

  const redirectTo = client.buildAuthorizationUrl(oidcConfig, parameters);
  return { redirectTo, state, codeVerifier };
}

export async function exchangeAuthorizationCode(
  config: EnvConfig,
  requestUrl: URL,
  state: string,
  codeVerifier: string,
): Promise<{ user: string; groups: string[] }> {
  if (!config.oidc) {
    throw new Error('OIDC is not configured');
  }

  // WHY: behind a reverse proxy c.req.url is often http://internal:3000/...; token
  // exchange redirect_uri must match the registered public callback URL.
  const callbackUrl = new URL(config.oidc.redirectUri);
  callbackUrl.search = requestUrl.search;

  const oidcConfig = await getOidcConfiguration(config);
  const tokens = await client.authorizationCodeGrant(oidcConfig, callbackUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedState: state,
  });

  const idClaims = (tokens.claims() ?? {}) as Record<string, unknown>;
  let groups = extractGroups(idClaims);
  let user = extractUsername(idClaims);

  if (tokens.access_token) {
    try {
      const subject = typeof idClaims.sub === 'string' ? idClaims.sub : client.skipSubjectCheck;
      const userinfo = await client.fetchUserInfo(oidcConfig, tokens.access_token, subject);
      groups = groups.length > 0 ? groups : extractGroups(userinfo);
      if (user === 'user') {
        user = extractUsername(userinfo);
      }
    } catch {
      // userinfo is optional when id_token carries enough claims
    }
  }

  return { user, groups };
}

export async function buildLogoutRedirect(
  config: EnvConfig,
  postLogoutRedirectUri: string,
): Promise<URL | null> {
  try {
    const oidcConfig = await getOidcConfiguration(config);
    return client.buildEndSessionUrl(oidcConfig, {
      post_logout_redirect_uri: postLogoutRedirectUri,
    });
  } catch {
    return null;
  }
}

export type { OidcConfig };
