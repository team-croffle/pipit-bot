import { container } from '@sapphire/framework';
import type { Guild, GuildMember, PartialGuildMember } from 'discord.js';

import { actorOf } from './audit/discord.js';
import { audit } from './audit/log.js';
import { isEnabled } from './features.js';
import { getGuildEventSettings } from './guild-event-settings.js';
import type { InviteMatch } from './invite-cache.js';
import { countInviteJoin } from './invite-stats.js';

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

/** How long a leaving member had been here, in whole days, when Discord still knows. */
export function daysStayed(member: GuildMember | PartialGuildMember): number | null {
  return member.joinedTimestamp ? Math.floor((Date.now() - member.joinedTimestamp) / DAY_MS) : null;
}

/**
 * Posts one line to the record channel, if one is set. Mentions render as names but
 * notify nobody — this is a record, not a greeting.
 */
async function postRecord(guild: Guild, line: string): Promise<void> {
  const channelId = getGuildEventSettings().recordChannelId;
  // The record channel is part of invite tracking.
  if (!channelId || !isEnabled('invites')) {
    return;
  }

  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased() || !('send' in channel)) {
    container.logger.warn(`[members] the record channel ${channelId} cannot be posted in`);
    return;
  }

  try {
    await channel.send({ content: line, allowedMentions: { parse: [] } });
  } catch (error) {
    container.logger.warn('[members] could not post to the record channel:', error);
  }
}

/** A member arrived: count the invite, record it, and post the record line. */
export async function onMemberJoin(member: GuildMember, invite: InviteMatch | null): Promise<void> {
  const inviter = inviterName(member, invite?.inviterId);
  if (invite) {
    void countInviteJoin(invite.code, invite.inviterId);
  }

  void audit({
    category: 'member',
    action: 'member.join',
    actor: actorOf(member.user, member),
    target: invite?.code ?? 'unknown',
    outcome: 'ok',
    detail: inviter ? `invited by ${inviter}` : undefined,
  });

  const via = invite
    ? `초대 \`${invite.code}\`${invite.inviterId ? ` (<@${invite.inviterId}>)` : ''}`
    : '초대 알 수 없음';
  await postRecord(member.guild, `📥 <@${member.id}> 입장 · ${via}`);
}

/** A member left: record it and post the record line. */
export async function onMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  const days = daysStayed(member);
  void audit({
    category: 'member',
    action: 'member.leave',
    actor: { id: member.id, name: member.displayName ?? member.user?.username ?? member.id },
    outcome: 'ok',
    detail: days === null ? undefined : `stayed ${days} day${days === 1 ? '' : 's'}`,
  });

  const stayed = days === null ? '' : ` · ${days}일 머묾`;
  await postRecord(member.guild, `📤 <@${member.id}> 퇴장${stayed}`);
}
