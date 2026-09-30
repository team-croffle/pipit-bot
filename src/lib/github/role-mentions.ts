/**
 * Whether the roles a message is about to mention can actually be pinged.
 *
 * WHY this is checked at all: a role mention is silently inert when the role is not
 * mentionable and the sender lacks Mention Everyone in that channel — Discord
 * delivers the message, the text reads `@team`, and nobody is notified. The
 * message still goes out; the delivery record says why the ping did not land, so
 * the operator finds the cause where every other silence is explained.
 *
 * Kept apart from dispatch.ts, which is at its size limit.
 */

import { PermissionFlagsBits, type Guild, type GuildBasedChannel } from 'discord.js';

/**
 * One sentence per role that cannot be mentioned in the channel, joined with a
 * space; undefined when every role can. A missing `members.me` reads as "unknown",
 * not "denied" — the same call the channel picker makes.
 */
export function describeUnmentionableRoles(
  guild: Guild,
  channel: GuildBasedChannel,
  roleIds: string[],
): string | undefined {
  const me = guild.members.me;
  const canMentionAll = me
    ? (channel.permissionsFor(me)?.has(PermissionFlagsBits.MentionEveryone) ?? false)
    : true;

  const problems: string[] = [];
  for (const roleId of roleIds) {
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      problems.push(`Role ${roleId} no longer exists in this server, so it cannot be mentioned.`);
      continue;
    }

    if (!role.mentionable && !canMentionAll) {
      problems.push(
        `Role ${role.name} cannot be mentioned here (not mentionable and the bot lacks Mention Everyone).`,
      );
    }
  }

  return problems.length > 0 ? problems.join(' ') : undefined;
}
