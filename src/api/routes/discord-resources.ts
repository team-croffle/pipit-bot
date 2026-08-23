import {
  getConfiguredGuild,
  listAssignableRoles,
  listTextChannels,
} from '../../lib/discord-guild.js';
import { sendJson } from '../http.js';
import type { RouteHandler } from '../types.js';

export const handleDiscordResources: RouteHandler = ({ method, url, res }) => {
  if (method !== 'GET') {
    return false;
  }

  if (url.pathname !== '/api/discord/channels' && url.pathname !== '/api/discord/roles') {
    return false;
  }

  const guild = getConfiguredGuild();
  if (!guild) {
    sendJson(res, 503, { error: 'Discord guild is not ready.' });
    return true;
  }

  if (url.pathname === '/api/discord/channels') {
    sendJson(res, 200, { channels: listTextChannels(guild) });
    return true;
  }

  sendJson(res, 200, { roles: listAssignableRoles(guild) });
  return true;
};
