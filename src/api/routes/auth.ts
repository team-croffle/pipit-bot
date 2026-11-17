import { container } from '@sapphire/framework';
import { and, eq } from 'drizzle-orm';
import type { Context, Hono } from 'hono';

import { audit } from '../../lib/audit/log.js';
import { getAuth } from '../../lib/auth/instance.js';
import { isMethodActive, type AuthMethod } from '../../lib/auth/methods.js';
import {
  describeErrorCause,
  getDiscovered,
  OidcDiscoveryError,
} from '../../lib/auth/oidc-discovery.js';
import { accounts } from '../../lib/db/auth-schema.js';
import { getDb } from '../../lib/db/client.js';
import type { EnvConfig } from '../../lib/env.js';
import { identityFromContext } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

// WHY 502 and not 500: a 500 says the bot has a bug. When the issuer does not
// resolve or does not answer, the bot is fine and the identity provider (or the
// network between them) is not — the operator needs to look there, not here.
const IDP_UNREACHABLE = 'The identity provider could not be reached.';

/**
 * Which Better Auth endpoints the dashboard may reach; everything else is 404
 * (2026-11-18, the team: none of its admin endpoints is exposed — users are managed
 * through /api/users). `method` is the sign-in method the request needs switched on.
 */
interface Allowed {
  verb: string;
  pattern: RegExp;
  method?: AuthMethod | 'social';
}

const ALLOWED: Allowed[] = [
  { verb: 'POST', pattern: /^\/sign-in\/username$/, method: 'password' },
  { verb: 'POST', pattern: /^\/sign-in\/social$/, method: 'social' },
  { verb: 'GET', pattern: /^\/callback\/(oidc|discord|github)$/, method: 'social' },
  { verb: 'GET', pattern: /^\/get-session$/ },
  { verb: 'POST', pattern: /^\/sign-out$/ },
];

const SOCIAL = new Set<AuthMethod>(['oidc', 'discord', 'github']);

function logIdpFailure(error: unknown): void {
  // The cause is the useful part (`getaddrinfo ENOTFOUND host`); the config itself is
  // never logged, so the client secret cannot end up in a log line.
  container.logger.error(`[api] OIDC discovery failed: ${describeErrorCause(error)}`, error);
}

/** The provider a social sign-in names, from a copy of the body. */
async function socialProvider(c: Context, path: string): Promise<string | undefined> {
  const callback = /^\/callback\/([a-z]+)$/.exec(path);
  if (callback) {
    return callback[1];
  }

  const body = (await c.req.raw
    .clone()
    .json()
    .catch(() => ({}))) as { provider?: unknown };
  return typeof body.provider === 'string' ? body.provider : undefined;
}

function recordFailure(actor: string, detail: string, denied: boolean): void {
  void audit({
    category: 'dashboard',
    action: 'auth.sign-in',
    actor: { name: actor },
    outcome: denied ? 'denied' : 'failed',
    detail,
  });
}

async function handle(c: Context<{ Variables: ApiVariables }>, config: EnvConfig) {
  const path = new URL(c.req.url).pathname.replace(/^\/api\/auth/, '');
  const rule = ALLOWED.find((entry) => entry.verb === c.req.method && entry.pattern.test(path));
  if (!rule) {
    return c.json({ error: 'Not found' }, 404);
  }

  const method = rule.method === 'social' ? await socialProvider(c, path) : rule.method;
  if (rule.method === 'social' && !SOCIAL.has(method as AuthMethod)) {
    return c.json({ error: 'Unknown sign-in method' }, 400);
  }
  if (method && !isMethodActive(method as AuthMethod)) {
    return c.json({ error: 'This sign-in method is switched off.' }, 403);
  }

  let auth;
  try {
    auth = await getAuth(config, method === 'oidc');
  } catch (error) {
    if (error instanceof OidcDiscoveryError) {
      logIdpFailure(error);
      return c.json({ error: IDP_UNREACHABLE }, 502);
    }
    throw error;
  }

  const attempted =
    path === '/sign-in/username'
      ? ((await c.req.raw
          .clone()
          .json()
          .catch(() => ({}))) as { username?: unknown })
      : undefined;
  const response = await auth.handler(c.req.raw);

  if (attempted && response.status >= 400) {
    const name = typeof attempted.username === 'string' ? attempted.username.slice(0, 64) : '?';
    recordFailure(name, `password: ${response.status}`, false);
  }
  const location = response.headers.get('location');
  if (path.startsWith('/callback/') && location?.includes('error=')) {
    const code = new URL(location, 'http://x').searchParams.get('error') ?? 'error';
    recordFailure(method ?? 'oauth', `${method}: ${code}`, code === 'not_allowed');
  }
  return response;
}

/** Where to send someone after sign-out: the provider's end-session page for an OIDC user. */
async function endSessionUrl(config: EnvConfig, userId: string | undefined): Promise<string> {
  const back = config.dashboardUrl ? `${new URL(config.dashboardUrl).origin}/login` : '/login';
  const endpoint = getDiscovered()?.end_session_endpoint;
  if (!endpoint || !userId || !config.auth.oidc) {
    return '/login';
  }

  const [account] = await getDb()
    .select({ idToken: accounts.idToken })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'oidc')));
  if (!account) {
    return '/login';
  }

  const url = new URL(endpoint);
  url.searchParams.set('post_logout_redirect_uri', back);
  if (account.idToken) {
    url.searchParams.set('id_token_hint', account.idToken);
  }
  return url.href;
}

/** /api/auth/*: the bot's own sign-in routes, then the Better Auth endpoints it allows. */
export function mountAuthRoutes(app: Hono<{ Variables: ApiVariables }>, config: EnvConfig): void {
  async function logout(c: Context<{ Variables: ApiVariables }>) {
    const identity = await identityFromContext(c);
    const auth = await getAuth(config);
    const signedOut = await auth.api
      .signOut({ headers: c.req.raw.headers, asResponse: true })
      .catch(() => null);
    const target = await endSessionUrl(config, identity?.userId);
    if (identity) {
      void audit({
        category: 'dashboard',
        action: 'auth.sign-out',
        actor: { name: identity.user ?? 'dashboard' },
        outcome: 'ok',
      });
    }

    const response =
      c.req.method === 'GET' ? c.redirect(target, 302) : c.json({ redirect: target });
    for (const cookie of signedOut?.headers.getSetCookie() ?? []) {
      response.headers.append('set-cookie', cookie);
    }
    return response;
  }

  app.get('/api/auth/logout', (c) => logout(c));
  app.post('/api/auth/logout', (c) => logout(c));

  // The sign-in page took over from these (v0.8.2).
  app.get('/api/auth/login', (c) => c.redirect('/login', 302));
  app.get('/api/auth/callback', (c) => {
    container.logger.warn(
      '[auth] an identity provider called the old /api/auth/callback — register /api/auth/callback/oidc as its redirect URI',
    );
    return c.redirect('/login?error=callback_moved', 302);
  });

  app.on(['GET', 'POST'], '/api/auth/*', (c) => handle(c, config));
}
