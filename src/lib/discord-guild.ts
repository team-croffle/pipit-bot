import { container } from '@sapphire/framework';
import { ChannelType, type Guild } from 'discord.js';

import { getEnv } from './env.js';

export function getConfiguredGuild(): Guild | undefined {
  const { client } = container;
  if (!client.isReady()) {
    return undefined;
  }

  const guildId = getEnv().guildId;
  if (guildId) {
    return client.guilds.cache.get(guildId);
  }

  return client.guilds.cache.first();
}

export function listTextChannels(guild: Guild): { id: string; name: string }[] {
  return [...guild.channels.cache.values()]
    .filter(
      (channel) =>
        channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement,
    )
    .map((channel) => ({ id: channel.id, name: `#${channel.name}` }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

export function listAssignableRoles(guild: Guild): { id: string; name: string }[] {
  return [...guild.roles.cache.values()]
    .filter((role) => role.id !== guild.id && !role.managed)
    .map((role) => ({ id: role.id, name: role.name }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}
