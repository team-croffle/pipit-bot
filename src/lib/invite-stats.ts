/**
 * How many members each invite brought in, kept across restarts.
 *
 * Discord counts an invite's uses, but the count goes with the invite: once it
 * expires or is deleted, nobody can say any more where those members came from. This
 * keeps the arrivals the bot itself has seen, per code.
 *
 * In the database since v0.8.0 (`invite_stats`; the old `data/invite-stats.json` is
 * moved in once). The counts stay in memory for the dashboard; an arrival is added in
 * the database itself (`joins + 1`), so no write can lose another's count.
 */

import { join } from 'node:path';

import { container } from '@sapphire/framework';
import { sql } from 'drizzle-orm';

import { dataDir } from './constants.js';
import { getDb } from './db/client.js';
import { migrateFile } from './db/migrate-file.js';
import { inviteStats } from './db/schema.js';

export interface InviteStat {
  joins: number;
  inviterId: string | null;
  lastJoinAt: string;
}

export interface InviteStats {
  codes: Record<string, InviteStat>;
}

const legacyPath = join(dataDir, 'invite-stats.json');
const CODE = /^[\w-]{1,64}$/;

let cache: InviteStats = { codes: {} };
let loadError: string | null = null;
let writing: Promise<void> = Promise.resolve();

export function parseInviteStats(raw: unknown): InviteStats {
  if (!raw || typeof raw !== 'object' || typeof (raw as InviteStats).codes !== 'object') {
    throw new Error('Expected { codes: { … } }');
  }

  const codes: Record<string, InviteStat> = {};
  for (const [code, value] of Object.entries((raw as InviteStats).codes ?? {})) {
    const stat = value as Partial<InviteStat>;
    if (!CODE.test(code) || typeof stat.joins !== 'number' || stat.joins < 0) {
      continue;
    }

    codes[code] = {
      joins: Math.floor(stat.joins),
      inviterId: typeof stat.inviterId === 'string' ? stat.inviterId : null,
      lastJoinAt: typeof stat.lastJoinAt === 'string' ? stat.lastJoinAt : '',
    };
  }

  return { codes };
}

export async function loadInviteStats(): Promise<InviteStats> {
  const outcome = await migrateFile({
    name: 'invite-stats.json',
    path: legacyPath,
    label: 'invite statistics',
    parse: parseInviteStats,
    insert: async (tx, parsed) => {
      const rows = Object.entries(parsed.codes).map(([code, stat]) => ({ code, ...stat }));
      if (rows.length > 0) {
        await tx.insert(inviteStats).values(rows).onConflictDoNothing();
      }
      return rows.length;
    },
  });
  // Shown on the dashboard, as a damaged file was before.
  loadError =
    outcome === 'broken'
      ? 'invite-stats.json is not valid and was not moved into the database; a copy was kept beside it. Fix the file and restart.'
      : null;

  const codes: Record<string, InviteStat> = {};
  for (const row of await getDb().select().from(inviteStats)) {
    codes[row.code] = { joins: row.joins, inviterId: row.inviterId, lastJoinAt: row.lastJoinAt };
  }
  cache = { codes };
  return cache;
}

export function getInviteStats(): InviteStats {
  return cache;
}

export function getInviteStatsLoadError(): string | null {
  return loadError;
}

/** Counts one arrival through `code`. Saves in the background, one write at a time. */
export function countInviteJoin(code: string, inviterId: string | null): Promise<void> {
  const previous = cache.codes[code];
  const lastJoinAt = new Date().toISOString();
  cache.codes[code] = {
    joins: (previous?.joins ?? 0) + 1,
    inviterId: inviterId ?? previous?.inviterId ?? null,
    lastJoinAt,
  };

  writing = writing
    .then(async () => {
      await getDb()
        .insert(inviteStats)
        .values({ code, joins: 1, inviterId, lastJoinAt })
        .onConflictDoUpdate({
          target: inviteStats.code,
          set: {
            joins: sql`${inviteStats.joins} + 1`,
            inviterId: sql`coalesce(${inviterId}, ${inviteStats.inviterId})`,
            lastJoinAt,
          },
        });
    })
    .catch((error: unknown) => {
      container.logger.warn('[invites] could not save invite statistics:', error);
    });
  return writing;
}
