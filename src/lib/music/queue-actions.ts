import { nudgeAutoplay } from './autoplay.js';
import { setPcmVolume } from './pcm-volume.js';
import { updatePlaybackOptions, type RepeatDefault } from './playback-options.js';
import { formatTrackTitle, getGuildQueue, type PlaybackActionResult } from './playback.js';
import { isVolume, MAX_VOLUME, MIN_VOLUME } from './volume.js';
import { hasCapability } from './worker-capabilities.js';

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

/**
 * Moves a queued track to a 1-based position. A position past the end means "last",
 * the way a person dragging a row off the bottom of a list would mean it.
 */
export function moveQueuedTrack(
  ref: QueuedTrackRef,
  to: number,
  guildId?: string,
): QueuedTrackResult {
  const queue = getGuildQueue(guildId);
  if (!queue) {
    return { ok: false, message: NO_SESSION };
  }

  if (!Number.isInteger(to) || to < 1) {
    return { ok: false, message: 'The new position must be 1 or more.' };
  }

  const found = findQueuedTrack(queue, ref);
  if (!found) {
    return notQueued(ref);
  }

  const target = Math.min(to, queue.tracks.size);
  const title = formatTrackTitle(found.track);
  if (target - 1 === found.position) {
    return { ok: true, message: `${title} is already at ${target}.`, title };
  }

  queue.node.move(found.track, target - 1);
  return { ok: true, message: `Moved ${title} to ${target}.`, title };
}

/**
 * Shuffles the waiting tracks once, in place. WHY not the player's shuffle mode: that
 * mode picks at random as each track ends, so the queue a person sees stops being the
 * order that plays.
 */
export function shuffleQueue(guildId?: string): PlaybackActionResult {
  const queue = getGuildQueue(guildId);
  if (!queue) {
    return { ok: false, message: NO_SESSION };
  }

  if (queue.tracks.size < 2) {
    return { ok: false, message: 'There need to be at least two queued tracks to shuffle.' };
  }

  queue.tracks.shuffle();
  return { ok: true, message: `Shuffled ${queue.tracks.size} tracks.` };
}

/** A setting like mono: it applies whether or not the bot is in a voice channel (pcm-volume.ts). */
export function setVolume(volume: number): PlaybackActionResult {
  if (!isVolume(volume)) {
    return {
      ok: false,
      message: `The volume is a whole number from ${MIN_VOLUME} to ${MAX_VOLUME}.`,
    };
  }

  setPcmVolume(volume);
  return {
    ok: true,
    message:
      volume > 100
        ? `Volume set to ${volume} — above 100 is a boost, and loud parts may distort.`
        : `Volume set to ${volume}.`,
  };
}

/** A setting, not an action on the session: it applies whether or not the bot is in a voice channel. */
export function setMono(on: boolean): PlaybackActionResult {
  void updatePlaybackOptions({ mono: on });
  return { ok: true, message: on ? 'Mono on: both ears hear the same.' : 'Mono off.' };
}

/** The repeat mode new sessions start in; the playing one keeps its own. */
export function setRepeatDefault(mode: RepeatDefault): PlaybackActionResult {
  void updatePlaybackOptions({ repeatDefault: mode });
  return { ok: true, message: `New sessions start with repeat ${mode}.` };
}

/** Also a setting; needs a music worker that can suggest tracks (`related`). */
export function setAutoplay(on: boolean): PlaybackActionResult {
  if (on && !hasCapability('related')) {
    return { ok: false, message: 'The music worker does not offer autoplay.' };
  }

  void updatePlaybackOptions({ autoplay: on });
  nudgeAutoplay();
  return {
    ok: true,
    message: on ? 'Autoplay on: similar tracks follow when the queue runs out.' : 'Autoplay off.',
  };
}
