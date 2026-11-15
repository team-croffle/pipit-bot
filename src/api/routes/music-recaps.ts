import type { Hono } from 'hono';

import {
  getRecapSettings,
  getRecapSettingsLoadError,
  saveRecapSettings,
  validateRecapSettings,
} from '../../lib/music/recap/settings.js';
import { dashboardViewer, dashboardWrite } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

/** The music recap settings, the recaps themselves and posting one again. */
export function mountMusicRecapRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  app.get('/api/settings/music-recap', dashboardViewer, (c) =>
    c.json({ settings: getRecapSettings(), loadError: getRecapSettingsLoadError() }),
  );

  // What changed goes on the audit line (the middleware never reads bodies itself).
  app.put(
    '/api/settings/music-recap',
    dashboardViewer,
    async (c, next) => {
      const body = await c.req.json<unknown>().catch(() => null);
      const checked = validateRecapSettings(body);
      if (typeof checked !== 'string') {
        c.set('auditNote', {
          target: 'music-recap',
          detail: `record ${checked.record ? 'on' : 'off'} · post ${checked.post ? 'on' : 'off'} · ${checked.timeZone} · top ${checked.topN}`,
        });
      }
      await next();
    },
    dashboardWrite,
    async (c) => {
      const checked = validateRecapSettings(await c.req.json<unknown>().catch(() => null));
      if (typeof checked === 'string') {
        return c.json({ error: checked }, 400);
      }

      return c.json({ settings: await saveRecapSettings(checked), loadError: null });
    },
  );
}
