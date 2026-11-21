import { container } from '@sapphire/framework';
import type { Hono } from 'hono';

import { getConfiguredGuild } from '../../lib/discord-guild.js';
import { phraseIn, say, textIn } from '../../lib/i18n/phrase.js';
import { PublishError, publishPanel } from '../../lib/reaction-roles/publish.js';
import {
  getReactionRoleLoadError,
  getReactionRoleSettings,
  parseReactionRoleSettings,
  saveReactionRoleSettings,
  updatePanel,
} from '../../lib/reaction-roles/settings.js';
import { dashboardViewer, dashboardWrite } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';
import { requestLanguage } from '../language.js';

/**
 * The panels, and the one action that reaches Discord.
 *
 * WHY publishing is its own route rather than a side effect of saving: sending or
 * editing a message is the one thing here an operator cannot undo from the dashboard,
 * and it fails for reasons a save never does. Keeping it separate means a save that
 * only fixes a typo cannot surprise a channel with a message.
 */
export function mountReactionRoleRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  // The guild id rides along so the dashboard can link a published panel straight
  // to its message without a second call.
  app.get('/api/reaction-roles', dashboardViewer, (c) =>
    c.json({
      ...getReactionRoleSettings(),
      guildId: getConfiguredGuild()?.id ?? null,
      loadError: getReactionRoleLoadError(),
    }),
  );

  app.put('/api/reaction-roles', dashboardViewer, dashboardWrite, async (c) => {
    try {
      const body = parseReactionRoleSettings(await c.req.json());
      return c.json(await saveReactionRoleSettings(body));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid settings';
      return c.json({ error: message }, 400);
    }
  });

  app.post('/api/reaction-roles/:panelId/publish', dashboardViewer, dashboardWrite, async (c) => {
    const guild = getConfiguredGuild();
    if (!guild) {
      return c.json({ error: textIn(requestLanguage(c), say('discordNotReady')) }, 503);
    }

    const panelId = c.req.param('panelId');
    const panel = getReactionRoleSettings().panels.find((stored) => stored.id === panelId);
    if (!panel) {
      return c.json({ error: textIn(requestLanguage(c), say('rrPanelMissing')) }, 404);
    }

    try {
      const published = await publishPanel(guild, panel);
      const saved = await updatePanel(published.panel);
      return c.json({
        panel: saved,
        messageUrl: `https://discord.com/channels/${guild.id}/${saved.channelId}/${saved.messageId}`,
        // The message went out either way; these emoji just did not go on it.
        failedEmoji: published.failedEmoji,
        warnings: published.warnings.map((phrase) => phraseIn(requestLanguage(c), phrase)),
      });
    } catch (error) {
      if (error instanceof PublishError) {
        return c.json({ error: phraseIn(requestLanguage(c), error.phrase) }, 400);
      }

      container.logger.error('Failed to publish a reaction role panel:', error);
      return c.json({ error: textIn(requestLanguage(c), say('rrPublishFailed')) }, 500);
    }
  });
}
