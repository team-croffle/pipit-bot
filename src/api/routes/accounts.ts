import type { Hono } from 'hono';

import { getAccountLinks, saveAccountLinks } from '../../lib/account-links.js';
import { dashboardViewer, dashboardWrite } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

/**
 * The GitHub ↔ Discord account links (account-links.ts), edited on the GitHub page.
 * Their own route since v0.8.0: they are identity that more than GitHub notifications
 * use, and saving the notification settings no longer touches them.
 */
export function mountAccountRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  app.get('/api/accounts', dashboardViewer, (c) => c.json({ accounts: getAccountLinks() }));

  app.put('/api/accounts', dashboardViewer, dashboardWrite, async (c) => {
    const body = await c.req.json<{ accounts?: unknown }>().catch(() => ({}));
    try {
      return c.json({
        accounts: await saveAccountLinks((body as { accounts?: unknown }).accounts),
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Invalid accounts' }, 400);
    }
  });
}
