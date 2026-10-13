import type { Context, Hono } from 'hono';

import { canEnqueuePlayback } from '../../lib/music/playback.js';
import { publicPlaylist } from '../../lib/music/playlists/access.js';
import { playPlaylist } from '../../lib/music/playlists/feeder.js';
import { resolveItems, type ItemSource } from '../../lib/music/playlists/sources.js';
import {
  addItems,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  getPlaylistsLoadError,
  listPlaylists,
  moveItem,
  PlaylistError,
  removeItem,
  renamePlaylist,
} from '../../lib/music/playlists/store.js';
import { dashboardViewer } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';
import { dashboardPlaylistViewer } from '../viewer.js';
import { dashboardOwner } from './music-search.js';

async function guarded(c: Context, work: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof PlaylistError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
}

function readSource(c: Context, body: Record<string, unknown>): ItemSource {
  const ref = body.ref;
  const asRef = (): { id: string } | { index: number } => {
    if (typeof ref === 'string' && ref !== 'all') {
      return { id: ref };
    }
    if (typeof ref === 'number' && Number.isInteger(ref) && ref >= 1) {
      return { index: ref };
    }
    throw new PlaylistError(400, 'ref must be a track id or a 1-based position');
  };

  switch (body.from) {
    case 'current':
      return { from: 'current' };
    case 'queue':
      return { from: 'queue', ref: ref === 'all' ? 'all' : asRef() };
    case 'recent':
      return { from: 'recent', ref: asRef() };
    case 'search':
      return {
        from: 'search',
        searchId: String(body.searchId ?? ''),
        index: Number(body.index ?? -1),
        owner: dashboardOwner(c),
      };
    case 'typed':
      return { from: 'typed', query: typeof body.query === 'string' ? body.query : '' };
    default:
      throw new PlaylistError(400, 'from must be current, queue, recent, search or typed');
  }
}

/** Playlists from the dashboard. Answers carry titles only — never the requests behind them. */
export function mountPlaylistRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  app.get('/api/playlists', dashboardViewer, (c) => {
    const viewer = dashboardPlaylistViewer(c);
    const playlists = listPlaylists(viewer).map((playlist) => {
      const { items: _items, ...summary } = publicPlaylist(playlist, viewer);
      return summary;
    });
    return c.json({ playlists, loadError: getPlaylistsLoadError() });
  });

  app.get('/api/playlists/:id', dashboardViewer, (c) =>
    guarded(c, () => {
      const viewer = dashboardPlaylistViewer(c);
      return c.json(publicPlaylist(getPlaylist(c.req.param('id'), viewer), viewer));
    }),
  );

  app.post('/api/playlists', dashboardViewer, (c) =>
    guarded(c, async () => {
      const viewer = dashboardPlaylistViewer(c);
      const body = await c.req.json<{ name?: unknown; scope?: unknown }>();
      const scope = body.scope === 'personal' ? 'personal' : 'shared';
      const playlist = await createPlaylist({ name: body.name, scope }, viewer);
      return c.json(publicPlaylist(playlist, viewer), 201);
    }),
  );

  app.patch('/api/playlists/:id', dashboardViewer, (c) =>
    guarded(c, async () => {
      const viewer = dashboardPlaylistViewer(c);
      const body = await c.req.json<{ name?: unknown }>();
      const playlist = await renamePlaylist(c.req.param('id'), body.name, viewer);
      return c.json(publicPlaylist(playlist, viewer));
    }),
  );

  app.delete('/api/playlists/:id', dashboardViewer, (c) =>
    guarded(c, async () => {
      await deletePlaylist(c.req.param('id'), dashboardPlaylistViewer(c));
      return c.json({ ok: true });
    }),
  );

  app.post('/api/playlists/:id/items', dashboardViewer, (c) =>
    guarded(c, async () => {
      const viewer = dashboardPlaylistViewer(c);
      const id = c.req.param('id');
      getPlaylist(id, viewer); // 404 before anything else
      const items = resolveItems(readSource(c, await c.req.json<Record<string, unknown>>()));
      const result = await addItems(id, items, viewer);
      return c.json(
        {
          ...publicPlaylist(result.playlist, viewer),
          added: result.added,
          skipped: result.skipped,
        },
        201,
      );
    }),
  );

  app.delete('/api/playlists/:id/items/:itemId', dashboardViewer, (c) =>
    guarded(c, async () => {
      const viewer = dashboardPlaylistViewer(c);
      const playlist = await removeItem(c.req.param('id'), c.req.param('itemId'), viewer);
      return c.json(publicPlaylist(playlist, viewer));
    }),
  );

  app.post('/api/playlists/:id/items/:itemId/move', dashboardViewer, (c) =>
    guarded(c, async () => {
      const viewer = dashboardPlaylistViewer(c);
      const body = await c.req.json<{ to?: unknown }>();
      if (typeof body.to !== 'number' || !Number.isInteger(body.to) || body.to < 0) {
        return c.json({ error: 'to must be a 0-based position' }, 400);
      }
      const playlist = await moveItem(c.req.param('id'), c.req.param('itemId'), body.to, viewer);
      return c.json(publicPlaylist(playlist, viewer));
    }),
  );

  app.post('/api/playlists/:id/play', dashboardViewer, (c) =>
    guarded(c, async () => {
      const playlist = getPlaylist(c.req.param('id'), dashboardPlaylistViewer(c));
      if (!canEnqueuePlayback()) {
        return c.json({ error: 'Bot is not in a voice channel.' }, 400);
      }
      const body = await c.req.json<{ shuffle?: unknown }>().catch(() => ({ shuffle: false }));
      const notice = playPlaylist(playlist, { shuffle: body.shuffle === true });
      return c.json(notice, notice.ok ? 200 : 400);
    }),
  );
}
