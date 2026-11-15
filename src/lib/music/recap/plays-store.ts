import { and, eq, isNull, lt } from 'drizzle-orm';

import { getDb } from '../../db/client.js';
import { musicPlays } from '../../db/schema.js';

/**
 * The play history behind the recaps: one row per track that started playing.
 *
 * The rows are written and counted in SQL (recap/aggregate.ts); nothing is kept in
 * memory. Who asked is stored so a person can see their own recap, and is never part of
 * anything this module hands to a screen.
 */

export const PLAY_RETENTION_DAYS = 400;

export type PlayOrigin = 'request' | 'playlist' | 'autoplay';
export type PlayEndReason = 'finished' | 'skipped' | 'stopped' | 'error';

export interface PlayStart {
  startedAt: string;
  guildId: string;
  fileKey: string;
  title: string;
  durationSec?: number;
  origin: PlayOrigin;
  requesterId?: string;
}

/** Records a track that started; returns the row's id, to finish it with. */
export async function recordPlayStart(play: PlayStart): Promise<number> {
  const [row] = await getDb()
    .insert(musicPlays)
    .values({
      startedAt: play.startedAt,
      guildId: play.guildId,
      fileKey: play.fileKey,
      title: play.title,
      durationSec: play.durationSec ?? null,
      origin: play.origin,
      requesterId: play.requesterId ?? null,
    })
    .returning({ id: musicPlays.id });
  return row!.id;
}

/** Ends a play once: a row that already has an end is left as it is. */
export async function finishPlay(
  id: number,
  reason: PlayEndReason,
  playedSec: number,
): Promise<void> {
  await getDb()
    .update(musicPlays)
    .set({ endReason: reason, playedSec: Math.max(0, Math.round(playedSec)) })
    .where(and(eq(musicPlays.id, id), isNull(musicPlays.endReason)));
}

/**
 * Closes rows a restart left open. Their length is unknown, so they keep the 0 seconds
 * they started with rather than a guess.
 */
export async function closeOpenPlays(): Promise<number> {
  const closed = await getDb()
    .update(musicPlays)
    .set({ endReason: 'stopped' })
    .where(isNull(musicPlays.endReason))
    .returning({ id: musicPlays.id });
  return closed.length;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Removes rows older than the retention period and says how many went. */
export async function sweepPlays(now = Date.now()): Promise<number> {
  const oldest = new Date(now - PLAY_RETENTION_DAYS * DAY_MS).toISOString();
  const removed = await getDb()
    .delete(musicPlays)
    .where(lt(musicPlays.startedAt, oldest))
    .returning({ id: musicPlays.id });
  return removed.length;
}
