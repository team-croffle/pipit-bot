import type { Hono } from 'hono';

import {
  getLanguageSettings,
  getLanguageSettingsLoadError,
  MESSAGE_FEATURES,
  saveLanguageSettings,
} from '../../lib/i18n/settings.js';
import { dashboardViewer, dashboardWrite } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

/** The language settings (lib/i18n/settings.ts): read by everyone signed in, changed by admins. */
export function mountLanguageRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  app.get('/api/settings/language', dashboardViewer, (c) =>
    c.json({
      settings: getLanguageSettings(),
      features: MESSAGE_FEATURES,
      loadError: getLanguageSettingsLoadError(),
    }),
  );

  app.put('/api/settings/language', dashboardViewer, dashboardWrite, async (c) => {
    const body = await c.req.json().catch(() => null);
    try {
      const settings = await saveLanguageSettings(body);
      const overrides = MESSAGE_FEATURES.filter((feature) => settings.features[feature])
        .map((feature) => `${feature}=${settings.features[feature]}`)
        .join(' ');
      c.set('auditNote', {
        detail: `dashboard=${settings.dashboard ?? 'browser'} messages=${settings.messages}${overrides ? ` ${overrides}` : ''}`,
      });
      return c.json({ settings, features: MESSAGE_FEATURES, loadError: null });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Invalid settings' }, 400);
    }
  });
}
