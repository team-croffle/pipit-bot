import { getConfiguredGuild } from '../../lib/discord-guild.js';
import {
  getGuildEventSettings,
  parseGuildEventSettings,
  saveGuildEventSettings,
} from '../../lib/guild-event-settings.js';
import { syncReactionRoleEmojis } from '../../lib/reaction-roles.js';
import { getDashboardIdentity, sendCapabilityForbidden } from '../auth/dashboard.js';
import { readJson, sendJson } from '../http.js';
import type { RouteHandler } from '../types.js';

export const handleGuildEvents: RouteHandler = async ({ method, url, req, res, config }) => {
  if (url.pathname !== '/api/guild-events') {
    return false;
  }

  if (method === 'GET') {
    sendJson(res, 200, getGuildEventSettings());
    return true;
  }

  if (method === 'PUT') {
    const identity = getDashboardIdentity(req, config);
    if (!identity.canWriteSettings) {
      sendCapabilityForbidden(res);
      return true;
    }

    try {
      const body = parseGuildEventSettings(await readJson<unknown>(req));
      const saved = await saveGuildEventSettings(body);
      const guild = getConfiguredGuild();
      if (guild) {
        void syncReactionRoleEmojis(guild, saved.reactionRoles);
      }
      sendJson(res, 200, saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid settings';
      sendJson(res, 400, { error: message });
    }

    return true;
  }

  return false;
};
