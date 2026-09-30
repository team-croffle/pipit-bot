import { container } from '@sapphire/framework';
import type { Context, Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import type { EnvConfig } from '../../lib/env.js';
import {
  buildLoginRedirect,
  buildLogoutRedirect,
  describeErrorCause,
  exchangeAuthorizationCode,
  OidcDiscoveryError,
} from '../auth/oidc.js';
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from '../auth/session.js';
import type { ApiVariables } from '../context.js';

const OIDC_STATE_COOKIE = 'pipit_oidc_state';
const OIDC_VERIFIER_COOKIE = 'pipit_oidc_verifier';

// WHY 502 and not 500: a 500 says the bot has a bug. When the issuer does not
// resolve or does not answer, the bot is fine and the identity provider (or the
// network between them) is not — the operator needs to look there, not here.
const IDP_UNREACHABLE = 'The identity provider could not be reached.';

function cookieBase(config: EnvConfig) {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'Lax' as const,
    path: '/',
  };
}

// Discovery wraps its failure; a fetch that dies later (token exchange) surfaces as
// undici's bare `TypeError: fetch failed` with the network error as its cause.
function isIdpUnreachable(error: unknown): boolean {
  return (
    error instanceof OidcDiscoveryError ||
    (error instanceof TypeError && error.message === 'fetch failed')
  );
}

function logIdpFailure(error: unknown): void {
  // The cause is the useful part (`getaddrinfo ENOTFOUND host`); the config
  // itself is never logged, so the client secret cannot end up in a log line.
  container.logger.error(`[api] OIDC discovery failed: ${describeErrorCause(error)}`, error);
}

/** Login, callback and logout for the dashboard's OIDC session. */
export function mountAuthRoutes(app: Hono<{ Variables: ApiVariables }>, config: EnvConfig): void {
  app.get('/api/auth/login', async (c) => {
    if (!config.oidc) {
      return c.json({ error: 'OIDC is not configured' }, 503);
    }

    try {
      const { redirectTo, state, codeVerifier } = await buildLoginRedirect(config);
      const base = cookieBase(config);
      setCookie(c, OIDC_STATE_COOKIE, state, { ...base, maxAge: 600 });
      setCookie(c, OIDC_VERIFIER_COOKIE, codeVerifier, { ...base, maxAge: 600 });
      return c.redirect(redirectTo.href, 302);
    } catch (error) {
      if (isIdpUnreachable(error)) {
        logIdpFailure(error);
        return c.json({ error: IDP_UNREACHABLE }, 502);
      }

      throw error;
    }
  });

  app.get('/api/auth/callback', async (c) => {
    if (!config.oidc) {
      return c.json({ error: 'OIDC is not configured' }, 503);
    }

    const state = getCookie(c, OIDC_STATE_COOKIE);
    const codeVerifier = getCookie(c, OIDC_VERIFIER_COOKIE);
    if (!state || !codeVerifier) {
      return c.json({ error: 'Missing OIDC state' }, 400);
    }

    try {
      const identity = await exchangeAuthorizationCode(
        config,
        new URL(c.req.url),
        state,
        codeVerifier,
      );
      const token = createSessionToken(identity, config.oidc.sessionSecret);
      const base = cookieBase(config);
      setCookie(c, SESSION_COOKIE, token, {
        ...base,
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      });
      deleteCookie(c, OIDC_STATE_COOKIE, base);
      deleteCookie(c, OIDC_VERIFIER_COOKIE, base);
      return c.redirect('/', 302);
    } catch (error) {
      if (isIdpUnreachable(error)) {
        logIdpFailure(error);
        return c.json({ error: IDP_UNREACHABLE }, 502);
      }

      // A state/verifier mismatch or a rejected grant. The request URL carries the
      // code, so only the library's message is logged, never the URL.
      const message = error instanceof Error ? error.message : 'OIDC callback failed';
      container.logger.warn(`[api] OIDC callback rejected: ${message}`);
      return c.json({ error: message }, 400);
    }
  });

  async function handleLogout(c: Context<{ Variables: ApiVariables }>) {
    const cfg = c.get('config');
    const base = cookieBase(cfg);
    deleteCookie(c, SESSION_COOKIE, base);

    if (cfg.oidc) {
      const redirectUri = `${new URL(cfg.oidc.redirectUri).origin}/`;
      const endSession = await buildLogoutRedirect(cfg, redirectUri);
      if (endSession) {
        return c.redirect(endSession.href, 302);
      }
    }

    return c.redirect('/', 302);
  }

  app.post('/api/auth/logout', (c) => handleLogout(c));
  app.get('/api/auth/logout', (c) => handleLogout(c));
}
