import { container } from '@sapphire/framework';
import { ChannelType, type Guild } from 'discord.js';

export function getConfiguredGuild(): Guild | undefined {
  const { client } = container;
  if (!client?.isReady()) {
    return undefined;
  }

  return client.guilds.cache.first();
}

export interface ChannelOption {
  id: string;
  name: string;
  /** The category the channel sits in, or null when it sits above all of them. */
  category: string | null;
}

/**
 * Lists the channels a dashboard picker can offer.
 *
 * WHY the category travels along: channel names only have to be unique within a
 * category, so a guild can hold several `#general`s and the picker would show the
 * same label several times with no way to tell them apart.
 *
 * Ordered the way Discord's own sidebar orders them rather than alphabetically, so
 * the list reads like the app the operator just came from. Uncategorised channels
 * sort first, which is also where Discord puts them.
 */
export function listTextChannels(guild: Guild): ChannelOption[] {
  return [...guild.channels.cache.values()]
    .filter(
      (channel) =>
        channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement,
    )
    .map((channel) => ({
      id: channel.id,
      name: `#${channel.name}`,
      category: channel.parent?.name ?? null,
      categoryPosition: channel.parent?.rawPosition ?? -1,
      position: channel.rawPosition,
    }))
    .toSorted((a, b) => a.categoryPosition - b.categoryPosition || a.position - b.position)
    .map(({ id, name, category }) => ({ id, name, category }));
}

export function listAssignableRoles(guild: Guild): { id: string; name: string }[] {
  return [...guild.roles.cache.values()]
    .filter((role) => role.id !== guild.id && !role.managed)
    .map((role) => ({ id: role.id, name: role.name }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

const MEMBER_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_MEMBERS = 1000;

const memberFetchedAt = new Map<string, number>();

/**
 * Lists guild members for dashboard pickers.
 *
 * WHY: the member cache is not populated by the gateway on its own — only a bulk
 * fetch fills it. That fetch is only needed by the dashboard, so it happens lazily
 * here rather than warming at boot the way invite-cache does.
 */
export async function listGuildMembers(guild: Guild): Promise<{ id: string; name: string }[]> {
  const fetchedAt = memberFetchedAt.get(guild.id) ?? 0;
  if (Date.now() - fetchedAt > MEMBER_CACHE_TTL_MS) {
    try {
      await guild.members.fetch();
      memberFetchedAt.set(guild.id, Date.now());
    } catch {
      // A picker that cannot load must not take the whole dashboard down.
    }
  }

  return [...guild.members.cache.values()]
    .filter((member) => !member.user.bot)
    .map((member) => ({ id: member.id, name: member.displayName }))
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_MEMBERS);
}
