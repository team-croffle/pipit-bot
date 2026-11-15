import { inArray, lt, sql } from 'drizzle-orm';

import { getDb } from '../../db/client.js';
import { musicTracks } from '../../db/schema.js';
import { PLAY_RETENTION_DAYS } from './plays-store.js';

/**
 * File key → its latest title and the request that prepares it again — what the year's
 * playlist (recap/year-playlist.ts) needs, since a file key is not something the music
 * worker can be asked for.
 *
 * WHY apart from the play history: the request sits here with no person beside it, at
 * the same level a playlist item keeps it. The request is opaque — sent back to the
 * worker unchanged, never shown or logged.
 */

export interface TrackRecord {
  fileKey: string;
  title: string;
  durationSec: number | null;
  request: string | null;
}

/** Notes a key that just played. A request already known is kept when this one has none. */
export async function upsertTrack(track: {
  fileKey: string;
  title: string;
  durationSec?: number;
  request?: string;
  at: string;
}): Promise<void> {
  await getDb()
    .insert(musicTracks)
    .values({
      fileKey: track.fileKey,
      title: track.title,
      durationSec: track.durationSec ?? null,
      request: track.request ?? null,
      lastPlayedAt: track.at,
    })
    .onConflictDoUpdate({
      target: musicTracks.fileKey,
      set: {
        title: track.title,
        durationSec: sql`coalesce(excluded.duration_sec, ${musicTracks.durationSec})`,
        request: sql`coalesce(excluded.request, ${musicTracks.request})`,
        lastPlayedAt: track.at,
      },
    });
}

export async function getTracks(fileKeys: string[]): Promise<Map<string, TrackRecord>> {
  if (fileKeys.length === 0) {
    return new Map();
  }

  const rows = await getDb()
    .select({
      fileKey: musicTracks.fileKey,
      title: musicTracks.title,
      durationSec: musicTracks.durationSec,
      request: musicTracks.request,
    })
    .from(musicTracks)
    .where(inArray(musicTracks.fileKey, fileKeys));
  return new Map(rows.map((row) => [row.fileKey, row]));
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function sweepTracks(now = Date.now()): Promise<number> {
  const oldest = new Date(now - PLAY_RETENTION_DAYS * DAY_MS).toISOString();
  const removed = await getDb()
    .delete(musicTracks)
    .where(lt(musicTracks.lastPlayedAt, oldest))
    .returning({ fileKey: musicTracks.fileKey });
  return removed.length;
}
