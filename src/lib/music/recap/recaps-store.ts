import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '../../db/client.js';
import { musicRecaps } from '../../db/schema.js';

/**
 * Recaps built for posting, one per guild and period (`2026-11`, `2026`), kept for good.
 * The summary is the public one — it holds no person (recap/aggregate.ts).
 */

export type RecapKind = 'month' | 'year';

export interface StoredRecap<Summary = unknown> {
  guildId: string;
  period: string;
  kind: RecapKind;
  summary: Summary;
  channelId: string | null;
  messageId: string | null;
  postedAt: string | null;
}

function toStored(row: typeof musicRecaps.$inferSelect): StoredRecap {
  return {
    guildId: row.guildId,
    period: row.period,
    kind: row.kind as RecapKind,
    summary: row.summary,
    channelId: row.channelId,
    messageId: row.messageId,
    postedAt: row.postedAt,
  };
}

export async function getRecap(guildId: string, period: string): Promise<StoredRecap | null> {
  const [row] = await getDb()
    .select()
    .from(musicRecaps)
    .where(and(eq(musicRecaps.guildId, guildId), eq(musicRecaps.period, period)));
  return row ? toStored(row) : null;
}

/** Saves (or replaces) the summary of a period; a posted message stays recorded. */
export async function saveRecap(
  guildId: string,
  period: string,
  kind: RecapKind,
  summary: unknown,
): Promise<void> {
  await getDb()
    .insert(musicRecaps)
    .values({ guildId, period, kind, summary })
    .onConflictDoUpdate({
      target: [musicRecaps.guildId, musicRecaps.period],
      set: { summary },
    });
}

export async function markPosted(
  guildId: string,
  period: string,
  channelId: string,
  messageId: string,
  at = new Date().toISOString(),
): Promise<void> {
  await getDb()
    .update(musicRecaps)
    .set({ channelId, messageId, postedAt: at })
    .where(and(eq(musicRecaps.guildId, guildId), eq(musicRecaps.period, period)));
}

export async function listRecaps(guildId: string): Promise<StoredRecap[]> {
  const rows = await getDb()
    .select()
    .from(musicRecaps)
    .where(eq(musicRecaps.guildId, guildId))
    .orderBy(desc(musicRecaps.period));
  return rows.map(toStored);
}
