import { container } from '@sapphire/framework';
import { ChannelType, PermissionFlagsBits, type Guild, type GuildBasedChannel } from 'discord.js';

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
  /** False when the bot cannot actually post there. */
  canPost: boolean;
}

/**
 * WHY this is reported rather than used to hide the channel: a channel already
 * configured would silently disappear from the picker, leaving a control showing
 * nothing and no clue why. Naming the problem beats hiding it — and posting is the
 * one thing the picker exists to arrange, so an option that cannot do it should say
 * so before it is chosen, not fail into the server log afterwards.
 */
function canBotPost(channel: GuildBasedChannel): boolean {
  const me = channel.guild.members.me;
  if (!me) {
    // Unknown rather than denied — never present the whole guild as unusable.
    return true;
  }

  const permissions = channel.permissionsFor(me);
  return (
    permissions?.has(PermissionFlagsBits.ViewChannel) === true &&
    permissions.has(PermissionFlagsBits.SendMessages)
  );
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
      canPost: canBotPost(channel),
      categoryPosition: channel.parent?.rawPosition ?? -1,
      position: channel.rawPosition,
    }))
    .toSorted((a, b) => a.categoryPosition - b.categoryPosition || a.position - b.position)
    .map(({ id, name, category, canPost }) => ({ id, name, category, canPost }));
}

export interface GuildEmojiOption {
  id: string;
  name: string;
  animated: boolean;
  /** The CDN image, for rendering the option. */
  url: string;
  /** What has to be typed into a message for the emoji to render. */
  markup: string;
}

/**
 * Lists the guild's custom emoji for dashboard pickers.
 *
 * WHY no extra intent: emoji ride along in GUILD_CREATE, so `Guilds` already fills
 * this cache. Only live add/remove events would need GuildExpressions, and a picker
 * that is a fetch behind is not worth an intent for.
 */
export async function listGuildEmojis(guild: Guild): Promise<GuildEmojiOption[]> {
  if (guild.emojis.cache.size === 0) {
    try {
      await guild.emojis.fetch();
    } catch {
      // A picker that cannot load must not take the whole dashboard down.
    }
  }

  return [...guild.emojis.cache.values()]
    .filter((emoji) => emoji.id !== null && emoji.name !== null)
    .map((emoji) => ({
      id: emoji.id,
      name: emoji.name ?? '',
      animated: emoji.animated === true,
      url: emoji.imageURL({ size: 64 }),
      markup: emoji.toString(),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
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
export interface GuildMemberSummary {
  id: string;
  name: string;
  /** Server avatar when the member set one, otherwise their account avatar. */
  avatarUrl: string;
}

export async function listGuildMembers(guild: Guild): Promise<GuildMemberSummary[]> {
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
    .map((member) => ({
      id: member.id,
      name: member.displayName,
      // 64px is what the dashboard renders it at; asking for the default 128 would
      // double the bytes for no visible gain.
      avatarUrl: member.displayAvatarURL({ size: 64 }),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_MEMBERS);
}
