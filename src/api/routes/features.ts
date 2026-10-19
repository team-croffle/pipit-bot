import type { Hono } from 'hono';

import { featureStates, isFeature, setFeature } from '../../lib/features.js';
import { dashboardViewer, dashboardWrite } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

/** The feature switches on the settings page. Changing one needs dashboard admin. */
export function mountFeatureRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  app.get('/api/settings/features', dashboardViewer, (c) => c.json({ features: featureStates() }));

  app.put('/api/settings/features', dashboardViewer, dashboardWrite, async (c) => {
    const body = await c.req.json<{ feature?: unknown; on?: unknown }>();
    if (!isFeature(body.feature) || typeof body.on !== 'boolean') {
      return c.json({ error: 'feature must be a known feature and on true or false' }, 400);
    }

    await setFeature(body.feature, body.on);
    return c.json({ features: featureStates() });
  });
}
