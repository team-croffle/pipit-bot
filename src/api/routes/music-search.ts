import type { Context, Hono } from 'hono';

import { searchMusic, SearchFailure } from '../../lib/music/search-client.js';
import { saveSearch } from '../../lib/music/search-results.js';
import { dashboardViewer, type DashboardIdentity } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

const STATUS: Record<SearchFailure['kind'], 400 | 501 | 503 | 502> = {
  rejected: 400,
  unsupported: 501,
  unavailable: 503,
  internal: 502,
};

/** Whose search it is: results can be picked only by the dashboard user who searched. */
export function dashboardOwner(c: Context): string {
  const identity = c.get('identity') as DashboardIdentity | undefined;
  return `dashboard:${identity?.user ?? identity?.groups[0] ?? 'dashboard'}`;
}

export function mountMusicSearchRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  /**
   * The dashboard's search: results come back as titles and lengths with an index;
   * the music worker's values stay on the server under the search id.
   */
  app.post('/api/music/search', dashboardViewer, async (c) => {
    const body = await c.req.json<{ query?: unknown }>().catch(() => ({ query: undefined }));
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query || query.length > 200) {
      return c.json({ error: 'query must be 1–200 characters' }, 400);
    }

    try {
      const results = await searchMusic(query);
      const searchId = results.length > 0 ? saveSearch(dashboardOwner(c), results) : null;
      return c.json({
        searchId,
        results: results.map(({ title, durationSec }, index) => ({ index, title, durationSec })),
      });
    } catch (error) {
      if (error instanceof SearchFailure) {
        return c.json({ error: error.message, code: error.kind }, STATUS[error.kind]);
      }
      throw error;
    }
  });
}
