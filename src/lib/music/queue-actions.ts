import { formatTrackTitle, getGuildQueue, type PlaybackActionResult } from './playback.js';
import { VOLUME_LEVELS, type VolumeLevel } from './volume-levels.js';

/**
 * A queued track, named the way the caller knows it: the dashboard by id, because its
 * list can be a poll behind the queue and "the 3rd track" may already be another one;
 * a command by the 1-based position the person just read in `!list`.
 */
export type QueuedTrackRef = { id: string } | { index: number };

export interface QueuedTrackResult extends PlaybackActionResult {
  title?: string;
}

const NO_SESSION = 'No active music session found in this server.';

function findQueuedTrack(
  queue: NonNullable<ReturnType<typeof getGuildQueue>>,
  ref: QueuedTrackRef,
) {
  const position =
    'id' in ref ? queue.tracks.store.findIndex((track) => track.id === ref.id) : ref.index - 1;
  const track = position >= 0 ? queue.tracks.store[position] : undefined;
  return track ? { position, track } : null;
}

function notQueued(ref: QueuedTrackRef): QueuedTrackResult {
  return {
    ok: false,
    message:
      'id' in ref
        ? 'That track is no longer in the queue.'
        : `No track found at index ${ref.index}.`,
  };
}

export function removeQueuedTrack(ref: QueuedTrackRef, guildId?: string): QueuedTrackResult {
  const queue = getGuildQueue(guildId);
  if (!queue) {
    return { ok: false, message: NO_SESSION };
  }

  const found = findQueuedTrack(queue, ref);
  if (!found) {
    return notQueued(ref);
  }

  const title = formatTrackTitle(found.track);
  if (!queue.node.remove(found.track)) {
    return { ok: false, message: 'Failed to remove that track.' };
  }

  return { ok: true, message: `Removed: ${title}`, title };
}

/** Like `!skipto`: the tracks queued before the target are dropped, not kept for later. */
export function skipToQueuedTrack(ref: QueuedTrackRef, guildId?: string): QueuedTrackResult {
  const queue = getGuildQueue(guildId);
  if (!queue) {
    return { ok: false, message: NO_SESSION };
  }

  const found = findQueuedTrack(queue, ref);
  if (!found) {
    return notQueued(ref);
  }

  const title = formatTrackTitle(found.track);
  if (!queue.node.skipTo(found.track)) {
    return { ok: false, message: 'Failed to skip to that track.' };
  }

  return { ok: true, message: `Skipped to: ${title}`, title };
}

export function setVolumeLevel(level: VolumeLevel, guildId?: string): PlaybackActionResult {
  const queue = getGuildQueue(guildId);
  if (!queue) {
    return { ok: false, message: NO_SESSION };
  }

  const value = VOLUME_LEVELS[level];
  // The player only holds a volume while something is streaming; setting it with
  // nothing playing reports false and changes nothing.
  if (!queue.node.setVolume(value)) {
    return { ok: false, message: 'Nothing is playing, so there is no volume to set.' };
  }

  return { ok: true, message: `Volume set to ${level} (${value}).` };
}
