import type { Hono, MiddlewareHandler } from 'hono';

import { featureStates, isFeature, setFeature } from '../../lib/features.js';
import { dashboardViewer, dashboardWrite } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

/**
 * Leaves the audit middleware which feature this request switches, and which way — the
 * middleware records the line but never reads request bodies.
 *
 * WHY before `dashboardWrite`: a refusal is recorded too, and it should say what was
 * refused. Reading the body here is free — Hono hands the route the parsed body back.
 */
interface FeatureBody {
  feature?: unknown;
  on?: unknown;
}

const noteFeature: MiddlewareHandler<{ Variables: ApiVariables }> = async (c, next) => {
  const body = await c.req.json<FeatureBody>().catch((): FeatureBody => ({}));
  if (isFeature(body.feature) && typeof body.on === 'boolean') {
    c.set('auditNote', { target: body.feature, detail: body.on ? 'on' : 'off' });
  }

  await next();
};

/** The feature switches on the settings page. Changing one needs dashboard admin. */
export function mountFeatureRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  app.get('/api/settings/features', dashboardViewer, (c) => c.json({ features: featureStates() }));

  app.put('/api/settings/features', dashboardViewer, noteFeature, dashboardWrite, async (c) => {
    const body = await c.req.json<FeatureBody>();
    if (!isFeature(body.feature) || typeof body.on !== 'boolean') {
      return c.json({ error: 'feature must be a known feature and on true or false' }, 400);
    }

    await setFeature(body.feature, body.on);
    return c.json({ features: featureStates() });
  });
}
