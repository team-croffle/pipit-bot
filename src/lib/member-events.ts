import type { GuildMember, PartialGuildMember } from 'discord.js';

import { actorOf } from './audit/discord.js';
import { audit } from './audit/log.js';
import type { InviteMatch } from './invite-cache.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function inviterName(
  member: GuildMember,
  inviterId: string | null | undefined,
): string | undefined {
  if (!inviterId) {
    return undefined;
  }

  const inviter =
    member.guild.members.cache.get(inviterId)?.displayName ??
    member.client.users.cache.get(inviterId)?.username;
  return inviter ? `${inviter} (${inviterId})` : inviterId;
}

/** A member arrived: who, through which invite, and who made it. */
export function recordMemberJoin(member: GuildMember, invite: InviteMatch | null): void {
  const inviter = inviterName(member, invite?.inviterId);
  void audit({
    category: 'member',
    action: 'member.join',
    actor: actorOf(member.user, member),
    target: invite?.code ?? 'unknown',
    outcome: 'ok',
    detail: inviter ? `invited by ${inviter}` : undefined,
  });
}

/** How long a leaving member had been here, in whole days, when Discord still knows. */
export function daysStayed(member: GuildMember | PartialGuildMember): number | null {
  return member.joinedTimestamp ? Math.floor((Date.now() - member.joinedTimestamp) / DAY_MS) : null;
}

/** A member left. */
export function recordMemberLeave(member: GuildMember | PartialGuildMember): void {
  const days = daysStayed(member);
  void audit({
    category: 'member',
    action: 'member.leave',
    actor: {
      id: member.id,
      name: member.displayName ?? member.user?.username ?? member.id,
    },
    outcome: 'ok',
    detail: days === null ? undefined : `stayed ${days} day${days === 1 ? '' : 's'}`,
  });
}
