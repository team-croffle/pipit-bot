import type { Hono } from 'hono';

import { isLanguage } from '../../lib/i18n/index.js';
import { getLanguageSettings } from '../../lib/i18n/settings.js';
import { findUserById, updateUser } from '../../lib/users/store.js';
import { dashboardViewer, identityFromContext, type DashboardIdentity } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';
import { discordIdOf } from '../viewer.js';

/** The signed-in person: who they are, and their own dashboard language (v0.8.3). */
export function mountMeRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  app.get('/api/me', async (c) => {
    const identity = await identityFromContext(c);
    if (!identity) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // The Discord account behind this user, when the GitHub page links it (personal playlists),
    // and the dashboard's language: the person's own, then the server default (v0.8.3).
    return c.json({
      ...identity,
      discordUserId: discordIdOf(identity) ?? null,
      locale: findUserById(identity.userId)?.locale ?? null,
      dashboardLanguage: getLanguageSettings().dashboard,
    });
  });

  app.put('/api/me/language', dashboardViewer, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { locale?: unknown };
    const locale = body.locale ?? null;
    if (locale !== null && !isLanguage(locale)) {
      return c.json({ error: 'locale must be en, ko or null' }, 400);
    }
    const identity = c.get('identity') as DashboardIdentity;
    if (!identity.userId) {
      return c.json({ error: 'No user to save it for' }, 400);
    }
    await updateUser(identity.userId, { locale });
    return c.json({ locale });
  });
}
