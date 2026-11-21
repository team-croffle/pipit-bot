/**
 * Publishing a panel: sending the message, editing it again, and keeping its
 * reactions in step with the options.
 *
 * WHY the checks come first: a reaction role that the bot cannot grant fails in
 * silence. The member reacts, nothing happens, and the only trace is a line in the
 * bot's log. Everything that can be known before sending is checked here so the
 * operator is told in the dashboard instead.
 */

import {
  PermissionFlagsBits,
  type Guild,
  type GuildTextBasedChannel,
  type Message,
} from 'discord.js';

import { resolveTemplateEmojis } from '../embed/emoji.js';
import { renderPlainEmbed } from '../embed/template.js';
import { say, type NoticeKey, type Phrase } from '../i18n/phrase.js';
import { emojiToReact, reactionMatchesEmoji } from './match.js';
import type { ReactionRolePanel } from './settings.js';

/** A reason the panel cannot be published, worded for the operator. */
/** A panel that cannot go out as it is; `message` is English, `phrase` the same in other languages. */
export class PublishError extends Error {
  readonly phrase: Phrase;

  constructor(key: NoticeKey, params?: Record<string, string | number>) {
    const said = say(key, params);
    super(said.message);
    this.name = 'PublishError';
    this.phrase = said.phrase;
  }
}

const REQUIRED = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.ReadMessageHistory,
] as const;

// Discord's own names for the permissions, as its settings show them.
const PERMISSION_LABELS = new Map<bigint, string>([
  [PermissionFlagsBits.ViewChannel, 'View Channel'],
  [PermissionFlagsBits.SendMessages, 'Send Messages'],
  [PermissionFlagsBits.EmbedLinks, 'Embed Links'],
  [PermissionFlagsBits.AddReactions, 'Add Reactions'],
  [PermissionFlagsBits.ReadMessageHistory, 'Read Message History'],
]);

function resolveChannel(guild: Guild, channelId: string): GuildTextBasedChannel {
  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) {
    throw new PublishError('rrChannelUnusable');
  }

  const me = guild.members.me;
  if (!me) {
    throw new PublishError('rrNoMember');
  }

  const permissions = channel.permissionsFor(me);
  const missing = REQUIRED.filter((flag) => !permissions?.has(flag)).map(
    (flag) => PERMISSION_LABELS.get(flag) ?? String(flag),
  );
  if (missing.length > 0) {
    throw new PublishError('rrMissingPermissions', { permissions: missing.join(', ') });
  }

  return channel;
}

/**
 * Taking a reaction off somebody else's behalf needs this, and two things want it:
 * putting the emoji back in order, and holding a panel at one reaction.
 *
 * WHY it is not in `REQUIRED`: a panel that neither reorders nor holds at one
 * reaction works perfectly without it, and panels published before either feature
 * existed must not start failing to publish.
 */
function canManageMessages(guild: Guild, channel: GuildTextBasedChannel): boolean {
  const me = guild.members.me;
  return me
    ? (channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages) ?? false)
    : false;
}

/**
 * Every role has to be one the bot could actually hand out: below its own highest
 * role, and not a role Discord manages on an integration's behalf.
 */
function checkRoles(guild: Guild, panel: ReactionRolePanel): void {
  const me = guild.members.me;
  if (!me) {
    throw new PublishError('rrNoMember');
  }

  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new PublishError('rrNoManageRoles');
  }

  for (const option of panel.options) {
    const role = guild.roles.cache.get(option.roleId);
    if (!role) {
      throw new PublishError('rrRoleMissing', { emoji: option.emoji });
    }

    if (role.managed) {
      throw new PublishError('rrRoleManaged', { role: role.name });
    }

    if (me.roles.highest.comparePositionTo(role) <= 0) {
      throw new PublishError('rrRoleTooHigh', { role: role.name });
    }
  }
}

const ORDER_WARNING = say('rrOrderWarning').phrase;

/**
 * True when adding the missing emoji would leave them out of the order the options
 * are in.
 *
 * Discord fixes a reaction's place the moment it is first added and offers no way to
 * move one afterwards. So appending only lands right when the option reactions
 * already on the message are the *first* options, in their order — anything else
 * (an option inserted in the middle, two swapped) can only be repaired by taking
 * them all off.
 *
 * Reactions that are not options at all are ignored: they sit wherever a member put
 * them and say nothing about the order of ours.
 */
function orderIsWrong(message: Message, panel: ReactionRolePanel): boolean {
  const positions = [...message.reactions.cache.values()]
    .map((reaction) =>
      panel.options.findIndex((option) => reactionMatchesEmoji(reaction, option.emoji)),
    )
    .filter((index) => index >= 0);

  return positions.some((option, position) => option !== position);
}

/**
 * True when the reactions have to be taken off and put back, rather than topped up.
 */
function needsRebuild(message: Message, panel: ReactionRolePanel): boolean {
  if (orderIsWrong(message, panel)) {
    return true;
  }

  // A panel held at one reaction must not come out of a publish still carrying the
  // marks it collected while the setting was off — the count it promises is one.
  return panel.singleReaction && message.reactions.cache.some((reaction) => reaction.count > 1);
}

interface SyncResult {
  failedEmoji: string[];
  warnings: Phrase[];
}

/**
 * Brings the message's reactions to exactly the options, in their order.
 *
 * WHY clearing the lot is acceptable: it takes members' reactions with it, but their
 * roles stay — only the marks go, and they come back the next time somebody reacts.
 * The alternative is a panel whose emoji are permanently in the wrong order, since
 * removing just the bot's reaction leaves the entry standing wherever a member also
 * reacted.
 *
 * WHY an emoji that will not go on is reported rather than thrown: the message is
 * already in the channel by then. Failing the publish would lose the id the caller
 * has not stored yet, and the next attempt would post a second copy.
 */
async function syncReactions(
  message: Message,
  panel: ReactionRolePanel,
  canManage: boolean,
): Promise<SyncResult> {
  const warnings: Phrase[] = [];
  let cleared = false;

  if (needsRebuild(message, panel)) {
    if (canManage) {
      try {
        await message.reactions.removeAll();
        cleared = true;
      } catch {
        warnings.push(ORDER_WARNING);
      }
    } else {
      warnings.push(ORDER_WARNING);
    }
  }

  if (!cleared) {
    // Only the bot's own reactions are removed. A member's reaction to an emoji that
    // is no longer an option is left alone — taking it away would look like the bot
    // undoing something the member did.
    const stale = message.reactions.cache.filter(
      (reaction) =>
        reaction.me &&
        !panel.options.some((option) => reactionMatchesEmoji(reaction, option.emoji)),
    );

    for (const reaction of stale.values()) {
      try {
        await reaction.users.remove(message.client.user.id);
      } catch {
        // A reaction we cannot take off is not worth failing the publish over.
      }
    }
  }

  const failedEmoji: string[] = [];
  for (const option of panel.options) {
    try {
      await message.react(emojiToReact(option.emoji, message.guild ?? undefined));
    } catch {
      failedEmoji.push(option.emoji);
    }
  }

  return { failedEmoji, warnings };
}

export interface PublishResult {
  panel: ReactionRolePanel;
  /** Emoji the bot could not put on the message, if any. */
  failedEmoji: string[];
  /** What went ahead anyway but the operator should know about. */
  warnings: Phrase[];
}

/**
 * Sends the panel, or edits the message it already owns.
 *
 * A message that has been deleted in Discord is republished as a new one rather than
 * leaving the panel stuck — the stored id is the bot's own bookkeeping, not something
 * the operator can repair by hand.
 */
export async function publishPanel(guild: Guild, panel: ReactionRolePanel): Promise<PublishResult> {
  if (panel.options.length === 0) {
    throw new PublishError('rrNoOptions');
  }

  const channel = resolveChannel(guild, panel.channelId);
  checkRoles(guild, panel);

  const canManage = canManageMessages(guild, channel);
  // WHY this one is fatal while a wrong emoji order is only a warning: a panel held
  // at one reaction cannot work at all without it. The bot would leave every
  // reaction standing and read the member's own unreact as a request to give the
  // role back, which is the opposite of what the setting asks for.
  if (panel.singleReaction && !canManage) {
    throw new PublishError('rrSingleNeedsManage');
  }

  // Shortcodes become real emoji here, the same way the reminder resolves them.
  const rendered = renderPlainEmbed(resolveTemplateEmojis(panel.embed, guild));
  if (!rendered.content && !rendered.embed) {
    throw new PublishError('rrEmpty');
  }

  const payload = {
    content: rendered.content,
    embeds: rendered.embed ? [rendered.embed] : [],
    // A panel exists to be reacted to, not to notify anyone.
    allowedMentions: { parse: [] },
  };

  let edited: Message | undefined;
  if (panel.messageId) {
    try {
      const existing = await channel.messages.fetch(panel.messageId);
      edited = await existing.edit(payload);
    } catch {
      edited = undefined;
    }
  }

  const message = edited ?? (await channel.send(payload));
  const { failedEmoji, warnings } = await syncReactions(message, panel, canManage);

  return { panel: { ...panel, messageId: message.id }, failedEmoji, warnings };
}
