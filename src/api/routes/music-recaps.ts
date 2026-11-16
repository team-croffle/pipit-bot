import type { Hono } from 'hono';

import { getConfiguredGuild } from '../../lib/discord-guild.js';
import { isEnabled } from '../../lib/features.js';
import { buildRecap, monthsWithPlays } from '../../lib/music/recap/aggregate.js';
import { currentPeriods, parsePeriod, type Period } from '../../lib/music/recap/periods.js';
import { postRecap } from '../../lib/music/recap/post.js';
import { getRecap, listRecaps } from '../../lib/music/recap/recaps-store.js';
import {
  getRecapSettings,
  getRecapSettingsLoadError,
  saveRecapSettings,
  validateRecapSettings,
} from '../../lib/music/recap/settings.js';
import { dashboardViewer, dashboardWrite, type DashboardIdentity } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';
import { discordIdOf } from '../viewer.js';

/**
 * WHY no person leaves here: every answer is a recap summary, whose shape carries no
 * person, or a list of periods. "Mine" is the signed-in person's own plays only — an
 * admin asking gets their own too, never someone else's.
 */

const BAD_PERIOD = { error: 'period must be YYYY or YYYY-MM' };

/** True when the period has not ended yet (the one that is running, or one to come). */
function isOpen(period: Period, timeZone: string): boolean {
  const now = currentPeriods(new Date(), timeZone);
  const running = period.kind === 'month' ? now.month.id : now.year.id;
  return period.id >= running;
}

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
          detail: `record ${checked.record ? 'on' : 'off'} · post ${checked.post ? 'on' : 'off'} · ${checked.timeZone} · top ${checked.topN} · ${checked.language}`,
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

  app.get('/api/music/recaps', dashboardViewer, async (c) => {
    const guild = getConfiguredGuild();
    if (!guild) {
      return c.json({ error: 'The bot is not connected to Discord yet.' }, 503);
    }

    const { timeZone } = getRecapSettings();
    const [months, stored] = await Promise.all([
      monthsWithPlays(guild.id, timeZone),
      listRecaps(guild.id),
    ]);
    const posted = new Map(stored.map((recap) => [recap.period, recap.postedAt]));
    const now = currentPeriods(new Date(), timeZone);
    const ids = new Set([
      now.month.id,
      now.year.id,
      ...months,
      ...months.map((m) => m.slice(0, 4)),
    ]);
    for (const recap of stored) {
      ids.add(recap.period);
    }

    const periods = [...ids]
      .map((id) => parsePeriod(id)!)
      .toSorted((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
      .map((period) => ({
        id: period.id,
        kind: period.kind,
        open: isOpen(period, timeZone),
        postedAt: posted.get(period.id) ?? null,
      }));
    return c.json({ timeZone, periods });
  });

  app.get('/api/music/recaps/:period', dashboardViewer, async (c) => {
    const period = parsePeriod(c.req.param('period'));
    if (!period) {
      return c.json(BAD_PERIOD, 400);
    }
    const guild = getConfiguredGuild();
    if (!guild) {
      return c.json({ error: 'The bot is not connected to Discord yet.' }, 503);
    }

    // What went out stays what is shown; anything else is counted now.
    const stored = await getRecap(guild.id, period.id);
    if (stored?.postedAt) {
      return c.json({ recap: stored.summary, postedAt: stored.postedAt, open: false });
    }
    const { timeZone, topN } = getRecapSettings();
    const recap = await buildRecap({ guildId: guild.id, period, timeZone, topN });
    return c.json({ recap, postedAt: null, open: isOpen(period, timeZone) });
  });

  app.get('/api/music/recaps/:period/me', dashboardViewer, async (c) => {
    const period = parsePeriod(c.req.param('period'));
    if (!period) {
      return c.json(BAD_PERIOD, 400);
    }
    const guild = getConfiguredGuild();
    if (!guild) {
      return c.json({ error: 'The bot is not connected to Discord yet.' }, 503);
    }
    const personId = discordIdOf(c.get('identity') as DashboardIdentity | undefined);
    if (!personId) {
      return c.json(
        { error: 'not_linked', message: 'This dashboard user is not linked to a Discord account.' },
        409,
      );
    }

    const { timeZone, topN } = getRecapSettings();
    const recap = await buildRecap({ guildId: guild.id, period, timeZone, topN, personId });
    return c.json({ recap, open: isOpen(period, timeZone) });
  });

  app.post(
    '/api/music/recaps/:period/post',
    dashboardViewer,
    async (c, next) => {
      c.set('auditNote', { target: c.req.param('period') });
      await next();
    },
    dashboardWrite,
    async (c) => {
      const period = parsePeriod(c.req.param('period'));
      if (!period) {
        return c.json(BAD_PERIOD, 400);
      }
      const guild = getConfiguredGuild();
      if (!guild) {
        return c.json({ error: 'The bot is not connected to Discord yet.' }, 503);
      }
      if (!isEnabled('music')) {
        return c.json({ error: 'Music is switched off.' }, 409);
      }
      if (isOpen(period, getRecapSettings().timeZone)) {
        return c.json({ error: 'This period is not over yet.' }, 400);
      }

      const outcome = await postRecap(guild.id, period);
      if (outcome.ok) {
        return c.json({ ok: true, messageId: outcome.messageId });
      }
      return c.json(
        { error: outcome.message, reason: outcome.reason },
        outcome.reason === 'failed' ? 502 : 409,
      );
    },
  );
}
