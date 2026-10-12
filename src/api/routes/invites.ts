import type { Guild } from 'discord.js';
import type { Hono } from 'hono';

import { getConfiguredGuild } from '../../lib/discord-guild.js';
import { getInviteStats, getInviteStatsLoadError } from '../../lib/invite-stats.js';
import { dashboardViewer } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

export interface InviteRow {
  code: string;
  inviterId: string | null;
  inviterName: string | null;
  /** Arrivals the bot has seen through this code. */
  joins: number;
  lastJoinAt: string | null;
  /** Discord's own use count, while the invite still exists. */
  uses: number | null;
  maxUses: number | null;
  expiresAt: string | null;
  /** False when the invite no longer exists on the server. */
  active: boolean;
}

interface LiveInvite {
  code: string;
  inviterId: string | null;
  uses: number | null;
  maxUses: number | null;
  expiresAt: string | null;
}

async function liveInvites(guild: Guild): Promise<LiveInvite[] | null> {
  try {
    const invites = await guild.invites.fetch();
    return [...invites.values()].map((invite) => ({
      code: invite.code,
      inviterId: invite.inviterId,
      uses: invite.uses,
      maxUses: invite.maxUses || null,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
    }));
  } catch {
    // Listing invites needs Manage Server (or View Audit Log); without either only the
    // bot's own counts remain.
    return null;
  }
}

function nameOf(guild: Guild | undefined, id: string | null): string | null {
  if (!id || !guild) {
    return null;
  }

  return (
    guild.members.cache.get(id)?.displayName ?? guild.client.users.cache.get(id)?.username ?? null
  );
}

export function mountInviteRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  app.get('/api/invites', dashboardViewer, async (c) => {
    const guild = getConfiguredGuild();
    const live = guild ? await liveInvites(guild) : null;
    const { codes } = getInviteStats();

    const rows = new Map<string, InviteRow>();
    for (const invite of live ?? []) {
      rows.set(invite.code, {
        ...invite,
        inviterName: nameOf(guild, invite.inviterId),
        joins: codes[invite.code]?.joins ?? 0,
        lastJoinAt: codes[invite.code]?.lastJoinAt || null,
        active: true,
      });
    }

    for (const [code, stat] of Object.entries(codes)) {
      if (!rows.has(code)) {
        rows.set(code, {
          code,
          inviterId: stat.inviterId,
          inviterName: nameOf(guild, stat.inviterId),
          joins: stat.joins,
          lastJoinAt: stat.lastJoinAt || null,
          uses: null,
          maxUses: null,
          expiresAt: null,
          // Without the live list nothing can be said about whether it still exists.
          active: live === null,
        });
      }
    }

    const invites = [...rows.values()].toSorted(
      (a, b) => b.joins - a.joins || (b.uses ?? 0) - (a.uses ?? 0),
    );
    // WHY: the list can be read with View Audit Log alone, but Discord then leaves out
    // the use counts — and without them nobody can tell which invite a member used.
    const hasUseCounts = live === null ? false : live.every((invite) => invite.uses !== null);
    return c.json({
      invites,
      canListInvites: live !== null,
      hasUseCounts,
      loadError: getInviteStatsLoadError(),
    });
  });
}
