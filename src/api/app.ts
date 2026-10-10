import { createReadStream, existsSync } from 'node:fs';
import { join, normalize, relative } from 'node:path';
import { Readable } from 'node:stream';

import { container } from '@sapphire/framework';
import { Hono, type Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { stream } from 'hono/streaming';

import { rootDir } from '../lib/constants.js';
import {
  canMentionAllRoles,
  getConfiguredGuild,
  listAssignableRoles,
  listGuildEmojis,
  listGuildMembers,
  listTextChannels,
  listVoiceChannels,
} from '../lib/discord-guild.js';
import type { EnvConfig } from '../lib/env.js';
import {
  getGuildEventLoadError,
  getGuildEventSettings,
  parseGuildEventSettings,
  saveGuildEventSettings,
} from '../lib/guild-event-settings.js';
import { getRuntimeConfig, updateRuntimeConfig } from '../lib/runtime-config.js';
import { dashboardViewer, dashboardWrite, resolveDashboardIdentity } from './auth/dashboard.js';
import { SESSION_COOKIE } from './auth/session.js';
import type { ApiVariables } from './context.js';
import { mountAuthRoutes } from './routes/auth.js';
import { mountGithubNotifyRoutes } from './routes/github-notify.js';
import { mountGithubWebhookRoutes } from './routes/github-webhook.js';
import { mountMusicJobRoutes } from './routes/music-jobs.js';
import { mountMusicRoutes } from './routes/music.js';
import { mountReactionRoleRoutes } from './routes/reaction-roles.js';

const distRoot = join(rootDir, 'dashboard', 'dist');

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

  mountAuthRoutes(app, config);

  app.get('/api/me', (c) => {
    const identity = resolveDashboardIdentity(config, getCookie(c, SESSION_COOKIE));
    if (!identity) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return c.json(identity);
  });

  app.get('/api/config', dashboardViewer, (c) => c.json(getRuntimeConfig()));

  app.put('/api/config', dashboardViewer, dashboardWrite, async (c) => {
    const body = await c.req.json<{ prefix?: string; musicChannelIds?: string[] }>();
    if (body.prefix !== undefined && !body.prefix.trim()) {
      return c.json({ error: 'prefix must not be empty' }, 400);
    }

    if (body.musicChannelIds !== undefined && !Array.isArray(body.musicChannelIds)) {
      return c.json({ error: 'musicChannelIds must be an array' }, 400);
    }

    const updated = updateRuntimeConfig(body);
    return c.json(updated);
  });

  app.get('/api/guild-events', dashboardViewer, (c) =>
    c.json({ ...getGuildEventSettings(), loadError: getGuildEventLoadError() }),
  );

  app.put('/api/guild-events', dashboardViewer, dashboardWrite, async (c) => {
    try {
      const body = parseGuildEventSettings(await c.req.json());
      return c.json(await saveGuildEventSettings(body));
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

  app.get('/api/discord/voice-channels', dashboardViewer, (c) => {
    const guild = getConfiguredGuild();
    if (!guild) {
      return c.json({ error: 'Discord guild is not ready.' }, 503);
    }

    return c.json({ channels: listVoiceChannels(guild) });
  });

  app.get('/api/discord/roles', dashboardViewer, (c) => {
    const guild = getConfiguredGuild();
    if (!guild) {
      return c.json({ error: 'Discord guild is not ready.' }, 503);
    }

    return c.json({ roles: listAssignableRoles(guild), canMentionAll: canMentionAllRoles(guild) });
  });

  /**
   * WHY `available` rather than a 503: the dashboard falls back to typing the value
   * by hand, which is what it did before this existed. A hard error would make the
   * page look broken on an install that simply has no App credentials.
   */
  app.get('/api/discord/emojis', dashboardViewer, async (c) => {
    const guild = getConfiguredGuild();
    if (!guild) {
      return c.json({ error: 'Discord guild is not ready.' }, 503);
    }

    return c.json({ emojis: await listGuildEmojis(guild) });
  });

  app.get('/api/discord/members', dashboardViewer, async (c) => {
    const guild = getConfiguredGuild();
    if (!guild) {
      return c.json({ error: 'Discord guild is not ready.' }, 503);
    }

    return c.json({ members: await listGuildMembers(guild) });
  });

  mountGithubNotifyRoutes(app, config);
  mountGithubWebhookRoutes(app);
  mountMusicRoutes(app);
  mountMusicJobRoutes(app);
  mountReactionRoleRoutes(app);

  app.get('*', async (c) => {
    const pathname = new URL(c.req.url).pathname;
    if (
      pathname === '/api' ||
      pathname.startsWith('/api/') ||
      pathname === '/internal' ||
      pathname.startsWith('/internal/') ||
      pathname === '/webhooks' ||
      pathname.startsWith('/webhooks/')
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
    container.logger.error('[api] unhandled error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  });

  return app;
}
