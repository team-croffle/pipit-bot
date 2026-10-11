import { formatTrackTitle, getGuildQueue, type PlaybackActionResult } from './playback.js';

/**
 * What has played in this session, newest first, and going back to it.
 *
 * The player keeps the history itself (newest first, capped by `maxHistorySize` in
 * the node options); it lives as long as the queue does, so leaving the voice
 * channel clears it. Nothing here is stored — that waits for the database (v0.8).
 */

export interface HistoryTrack {
  id: string;
  title: string;
  duration: string | null;
}

export function getRecentTracks(guildId?: string): HistoryTrack[] {
  const queue = getGuildQueue(guildId);
  if (!queue) {
    return [];
  }

  return queue.history.tracks.store.map((track) => ({
    id: track.id,
    title: formatTrackTitle(track),
    duration: track.duration ?? null,
  }));
}

/**
 * Plays the previous track; the one playing now goes back to the front of the queue,
 * so going back is never a way to lose a track.
 */
export async function playPrevious(guildId?: string): Promise<PlaybackActionResult> {
  const queue = getGuildQueue(guildId);
  if (!queue) {
    return { ok: false, message: 'No active music session found in this server.' };
  }

  const previous = queue.history.tracks.store[0];
  if (!previous) {
    return { ok: false, message: 'Nothing has played before this track.' };
  }

  try {
    await queue.history.back(true);
  } catch {
    return { ok: false, message: 'Could not go back to the previous track.' };
  }

  return { ok: true, message: `Back to: ${formatTrackTitle(previous)}` };
}
