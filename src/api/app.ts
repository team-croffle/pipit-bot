import { createReadStream, existsSync } from 'node:fs';
import { join, normalize, relative } from 'node:path';
import { Readable } from 'node:stream';

import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { stream } from 'hono/streaming';

import { rootDir } from '../lib/constants.js';
import { getConfiguredGuild, listAssignableRoles, listTextChannels } from '../lib/discord-guild.js';
import type { EnvConfig } from '../lib/env.js';
import {
  getGuildEventSettings,
  parseGuildEventSettings,
  saveGuildEventSettings,
} from '../lib/guild-event-settings.js';
import {
  getPlaybackState,
  pausePlayback,
  resumePlayback,
  skipPlayback,
} from '../lib/music/playback.js';
import { schedulePlayWhenReady, submitMusicJob } from '../lib/music/prepare-track.js';
import { syncReactionRoleEmojis } from '../lib/reaction-roles.js';
import { getRuntimeConfig, updateRuntimeConfig } from '../lib/runtime-config.js';
import { dashboardViewer, dashboardWrite, resolveDashboardIdentity } from './auth/dashboard.js';
import { internalAuth } from './auth/internal.js';
import { buildLoginRedirect, buildLogoutRedirect, exchangeAuthorizationCode } from './auth/oidc.js';
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from './auth/session.js';
import type { ApiVariables } from './context.js';
import {
  getJob,
  listJobs,
  resolveFailed,
  resolveReady,
  type TrackMeta,
} from './jobs/pending-registry.js';

const distRoot = join(rootDir, 'dashboard', 'dist');
const OIDC_STATE_COOKIE = 'pipit_oidc_state';
const OIDC_VERIFIER_COOKIE = 'pipit_oidc_verifier';

const MIME_BY_EXT: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function cookieBase(config: EnvConfig) {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'Lax' as const,
    path: '/',
  };
}

function looksLikeAsset(pathname: string): boolean {
  const name = pathname.split('/').at(-1) ?? '';
  return name.includes('.') && !name.endsWith('.html');
}

function resolveUnderDist(pathname: string): string | undefined {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const resolved = normalize(join(distRoot, relativePath));
  const rel = relative(distRoot, resolved);
  if (rel.startsWith('..') || rel === '..') {
    return undefined;
  }

  return resolved;
}

async function serveDistFile(c: Context, filePath: string): Promise<Response | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  const type = MIME_BY_EXT[ext] ?? 'application/octet-stream';
  const body = createReadStream(filePath);

  return stream(c, async (streamWriter) => {
    c.header('Content-Type', type);
    await streamWriter.pipe(Readable.toWeb(body) as ReadableStream);
  });
}

export function createApp(config: EnvConfig): Hono<{ Variables: ApiVariables }> {
  const app = new Hono<{ Variables: ApiVariables }>();

  app.use('*', async (c, next) => {
    c.set('config', config);
    await next();
  });

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  app.get('/api/auth/login', async (c) => {
    if (!config.oidc) {
      return c.json({ error: 'OIDC is not configured' }, 503);
    }

    const { redirectTo, state, codeVerifier } = await buildLoginRedirect(config);
    const base = cookieBase(config);
    setCookie(c, OIDC_STATE_COOKIE, state, { ...base, maxAge: 600 });
    setCookie(c, OIDC_VERIFIER_COOKIE, codeVerifier, { ...base, maxAge: 600 });
    return c.redirect(redirectTo.href, 302);
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
      const message = error instanceof Error ? error.message : 'OIDC callback failed';
      return c.json({ error: message }, 400);
    }
  });

  async function handleLogout(c: Context<{ Variables: ApiVariables }>) {
    const cfg = c.get('config');
    const base = cookieBase(cfg);
    deleteCookie(c, SESSION_COOKIE, base);

    if (cfg.oidc) {
      const redirectUri = `${new URL(c.req.url).origin}/`;
      const endSession = await buildLogoutRedirect(cfg, redirectUri);
      if (endSession) {
        return c.redirect(endSession.href, 302);
      }
    }

    return c.redirect('/', 302);
  }

  app.post('/api/auth/logout', (c) => handleLogout(c));
  app.get('/api/auth/logout', (c) => handleLogout(c));

  app.get('/api/me', (c) => {
    const identity = resolveDashboardIdentity(config, getCookie(c, SESSION_COOKIE));
    if (!identity) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return c.json(identity);
  });

  app.get('/api/config', dashboardViewer, (c) =>
    c.json({ ...getRuntimeConfig(), role: config.role }),
  );

  app.put('/api/config', dashboardViewer, dashboardWrite, async (c) => {
    const body = await c.req.json<{ prefix?: string; commandChannelId?: string | null }>();
    if (body.prefix !== undefined && !body.prefix.trim()) {
      return c.json({ error: 'prefix must not be empty' }, 400);
    }

    const updated = updateRuntimeConfig(body);
    return c.json(updated);
  });

  app.get('/api/guild-events', dashboardViewer, (c) => c.json(getGuildEventSettings()));

  app.put('/api/guild-events', dashboardViewer, dashboardWrite, async (c) => {
    try {
      const body = parseGuildEventSettings(await c.req.json());
      const saved = await saveGuildEventSettings(body);
      const guild = getConfiguredGuild();
      if (guild) {
        void syncReactionRoleEmojis(guild, saved.reactionRoles);
      }
      return c.json(saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid settings';
      return c.json({ error: message }, 400);
    }
  });

  app.get('/api/discord/channels', dashboardViewer, (c) => {
    const guild = getConfiguredGuild();
    if (!guild) {
      return c.json({ error: 'Discord guild is not ready.' }, 503);
    }

    return c.json({ channels: listTextChannels(guild) });
  });

  app.get('/api/discord/roles', dashboardViewer, (c) => {
    const guild = getConfiguredGuild();
    if (!guild) {
      return c.json({ error: 'Discord guild is not ready.' }, 503);
    }

    return c.json({ roles: listAssignableRoles(guild) });
  });

  app.get('/api/music/playback', dashboardViewer, (c) => c.json(getPlaybackState()));

  app.post('/api/music/playback/pause', dashboardViewer, (c) => {
    const result = pausePlayback();
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/resume', dashboardViewer, (c) => {
    const result = resumePlayback();
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/skip', dashboardViewer, (c) => {
    const result = skipPlayback();
    return c.json(result, result.ok ? 200 : 400);
  });

  app.get('/api/music/jobs', dashboardViewer, (c) => c.json({ jobs: listJobs() }));

  app.get('/api/music/jobs/:jobId', dashboardViewer, (c) => {
    const job = getJob(c.req.param('jobId'));
    if (!job) {
      return c.json({ error: 'Job not found' }, 404);
    }

    return c.json(job);
  });

  app.post('/api/music/jobs', dashboardViewer, async (c) => {
    const body = await c.req.json<{ jobId?: string; query?: string }>();
    if (!body.jobId || !body.query?.trim()) {
      return c.json({ error: 'jobId and query are required' }, 400);
    }

    try {
      const job = await submitMusicJob(body.jobId, body.query.trim());
      schedulePlayWhenReady(body.jobId);
      return c.json(job, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enqueue job';
      resolveFailed(body.jobId, message);
      return c.json({ error: message }, 503);
    }
  });

  app.post('/internal/music/jobs/:jobId/ready', internalAuth, async (c) => {
    const body = await c.req.json<{ track?: TrackMeta }>();
    if (!body.track?.file) {
      return c.json({ error: 'track.file is required' }, 400);
    }

    const job = resolveReady(c.req.param('jobId'), body.track);
    return c.json(job);
  });

  app.post('/internal/music/jobs/:jobId/failed', internalAuth, async (c) => {
    const body = await c.req.json<{ error?: string }>();
    const job = resolveFailed(c.req.param('jobId'), body.error ?? 'Job failed');
    return c.json(job);
  });

  app.get('*', async (c) => {
    const pathname = new URL(c.req.url).pathname;
    if (
      pathname === '/api' ||
      pathname.startsWith('/api/') ||
      pathname === '/internal' ||
      pathname.startsWith('/internal/')
    ) {
      return c.json({ error: 'Not found' }, 404);
    }

    if (!existsSync(distRoot)) {
      if (looksLikeAsset(pathname)) {
        return c.json({ error: 'Not found' }, 404);
      }

      return c.json({ error: 'Dashboard is not built. Run yarn dashboard:build.' }, 503);
    }

    const filePath = resolveUnderDist(pathname);
    if (filePath) {
      const served = await serveDistFile(c, filePath);
      if (served) {
        return served;
      }
    }

    if (looksLikeAsset(pathname)) {
      return c.json({ error: 'Not found' }, 404);
    }

    const indexPath = join(distRoot, 'index.html');
    const served = await serveDistFile(c, indexPath);
    if (served) {
      return served;
    }

    return c.json({ error: 'Dashboard is not built. Run yarn dashboard:build.' }, 503);
  });

  app.onError((error, c) => {
    // oxlint-disable-next-line no-console
    console.error('API handler error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  });

  return app;
}
