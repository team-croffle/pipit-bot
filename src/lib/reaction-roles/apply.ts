/**
 * What a reaction on a panel does to the member's roles.
 *
 * WHY this is not simply "add on react, remove on unreact" in each listener: a panel
 * held at one reaction never sees a member's unreact, because the bot takes the
 * reaction off itself and that removal arrives through the same listener a member's
 * would. Acting on it there would undo the role the member had just asked for. So the
 * two modes read the same event differently, and the rule lives in one place rather
 * than half in each listener.
 */

import type {
  Guild,
  GuildMember,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';

import { reactionMatchesEmoji } from './match.js';
import { findPanelByMessage, type ReactionRoleOption, type ReactionRolePanel } from './settings.js';

export interface PanelReaction {
  guild: Guild;
  panel: ReactionRolePanel;
  option: ReactionRoleOption;
  member: GuildMember;
  reaction: MessageReaction;
}

/**
 * The panel, option and member behind a reaction — or nothing, when the reaction was
 * on a message that is not a panel, or on an emoji that is not one of its options.
 */
export async function resolvePanelReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): Promise<PanelReaction | undefined> {
  const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
  const fullUser = user.partial ? await user.fetch() : user;
  if (fullUser.bot) {
    return undefined;
  }

  const guild = fullReaction.message.guild;
  const panel = findPanelByMessage(fullReaction.message.id);
  if (!panel || !guild) {
    return undefined;
  }

  const option = panel.options.find((entry) => reactionMatchesEmoji(fullReaction, entry.emoji));
  if (!option) {
    return undefined;
  }

  return {
    guild,
    panel,
    option,
    member: await guild.members.fetch(fullUser.id),
    reaction: fullReaction,
  };
}

/**
 * Applies a reaction that was just added.
 *
 * On a panel held at one reaction the role is toggled against what the member already
 * has, since the reaction itself does not survive to say. The role work happens first:
 * if the bot turns out not to be allowed to take the reaction off, the member still
 * gets what they asked for.
 */
export async function applyReactionAdded(hit: PanelReaction): Promise<void> {
  const { member, option, panel, reaction } = hit;

  if (!panel.singleReaction) {
    await member.roles.add(option.roleId);
    return;
  }

  if (member.roles.cache.has(option.roleId)) {
    await member.roles.remove(option.roleId);
  } else {
    await member.roles.add(option.roleId);
  }

  await reaction.users.remove(member.id);
}

/**
 * Applies a reaction that was just removed.
 *
 * Does nothing on a panel held at one reaction — the removal there is the bot's own
 * doing, and a member has no way to produce one.
 */
export async function applyReactionRemoved(hit: PanelReaction): Promise<void> {
  if (hit.panel.singleReaction) {
    return;
  }

  await hit.member.roles.remove(hit.option.roleId);
}
