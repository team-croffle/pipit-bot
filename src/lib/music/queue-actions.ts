import { say } from '../i18n/phrase.js';
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
    ...('id' in ref ? say('trackGone') : say('noTrackAt', { index: ref.index })),
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
    return { ok: false, ...say('removeFailed') };
  }

  return { ok: true, ...say('removed', { title }), title };
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
    return { ok: false, ...say('skipToFailed') };
  }

  return { ok: true, ...say('skippedTo', { title }), title };
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
    return { ok: false, ...say('positionTooLow') };
  }

  const found = findQueuedTrack(queue, ref);
  if (!found) {
    return notQueued(ref);
  }

  const target = Math.min(to, queue.tracks.size);
  const title = formatTrackTitle(found.track);
  if (target - 1 === found.position) {
    return { ok: true, ...say('alreadyAt', { title, position: target }), title };
  }

  queue.node.move(found.track, target - 1);
  return { ok: true, ...say('movedTo', { title, position: target }), title };
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
    return { ok: false, ...say('shuffleNeedsTwo') };
  }

  queue.tracks.shuffle();
  return { ok: true, ...say('shuffled', { count: queue.tracks.size }) };
}

/** A setting like mono: it applies whether or not the bot is in a voice channel (pcm-volume.ts). */
export function setVolume(volume: number): PlaybackActionResult {
  if (!isVolume(volume)) {
    return {
      ok: false,
      ...say('volumeRange', { min: MIN_VOLUME, max: MAX_VOLUME }),
    };
  }

  setPcmVolume(volume);
  return {
    ok: true,
    ...(volume > 100 ? say('volumeBoost', { volume }) : say('volumeSet', { volume })),
  };
}

/** A setting, not an action on the session: it applies whether or not the bot is in a voice channel. */
export function setMono(on: boolean): PlaybackActionResult {
  void updatePlaybackOptions({ mono: on });
  return { ok: true, ...say(on ? 'monoOn' : 'monoOff') };
}

/** The repeat mode new sessions start in; the playing one keeps its own. */
export function setRepeatDefault(mode: RepeatDefault): PlaybackActionResult {
  void updatePlaybackOptions({ repeatDefault: mode });
  return { ok: true, ...say('repeatDefault', { mode }) };
}

/** Also a setting; needs a music worker that can suggest tracks (`related`). */
export function setAutoplay(on: boolean): PlaybackActionResult {
  if (on && !hasCapability('related')) {
    return { ok: false, ...say('noAutoplay') };
  }

  void updatePlaybackOptions({ autoplay: on });
  nudgeAutoplay();
  return {
    ok: true,
    message: on ? 'Autoplay on: similar tracks follow when the queue runs out.' : 'Autoplay off.',
  };
}
