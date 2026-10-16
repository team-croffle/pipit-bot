import { randomUUID } from 'node:crypto';

import { container } from '@sapphire/framework';
import { QueueRepeatMode, type GuildQueue, type Player, type Track } from 'discord-player';

import { waitForJob, type TrackMeta } from '../../api/jobs/pending-registry.js';
import { forgetAutoplayFiles, isAutoplayTrack, markAutoplayFile } from './autoplay-files.js';
import { getPlaybackOptions } from './playback-options.js';
import { getGuildQueue } from './playback.js';
import { getFeedStatus } from './playlists/feed-state.js';
import { playPreparedTrack, rememberTrackMeta, submitMusicJob } from './prepare-track.js';
import { MAX_EXCLUDE, MAX_SEEDS, relatedMusic } from './related-client.js';
import { sourceOf } from './track-source.js';
import { hasCapability } from './worker-capabilities.js';

/**
 * Autoplay: when the last queued track starts, ask the music worker what fits after it,
 * prepare that while the track plays, and put it in the queue in the track's last ten
 * seconds — unless someone queued a track of their own meanwhile, which always wins.
 *
 * WHY prepare early but queue late: preparing can take longer than ten seconds, so it
 * starts with the track; queueing waits so that a track someone adds during the song
 * plays next instead of landing behind the bot's own pick.
 */
const QUEUE_BEFORE_END_MS = 10_000;
/** Candidates tried in turn when one cannot be prepared (the first, then one more). */
const ATTEMPTS = 2;
/** Requests played lately — sent as seeds (newest first) and as what not to offer again. */
const RECENT_KEEP = MAX_EXCLUDE;

let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const recent: string[] = [];
/** Where the queue comes from and how a track is queued — replaced by local checks. */
let queueNow: () => GuildQueue | undefined = () => getGuildQueue();
let queueTrack = (track: TrackMeta): Promise<void> => playPreparedTrack(track, false);

function remember(track: Track): void {
  const query = sourceOf(track)?.query;
  if (!query) {
    return;
  }
  const at = recent.indexOf(query);
  if (at !== -1) {
    recent.splice(at, 1);
  }
  recent.unshift(query);
  recent.length = Math.min(recent.length, RECENT_KEEP);
}

/** Drops whatever autoplay was preparing or waiting to queue. */
function cancel(): void {
  generation += 1;
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
}

function wanted(queue: GuildQueue | undefined): queue is GuildQueue {
  return (
    getPlaybackOptions().autoplay &&
    hasCapability('related') &&
    queue !== undefined &&
    queue.repeatMode === QueueRepeatMode.OFF &&
    getFeedStatus() === null &&
    queue.tracks.size === 0
  );
}

function remainingMs(queue: GuildQueue): number | null {
  const timestamp = queue.node.getTimestamp();
  return timestamp ? timestamp.total.value - timestamp.current.value : null;
}

async function enqueue(run: number, track: TrackMeta): Promise<void> {
  const queue = queueNow();
  // Still wanted? The track may have been stopped, someone may have queued their own,
  // autoplay may be off now, or a playlist started.
  if (run !== generation || !wanted(queue)) {
    return;
  }
  rememberTrackMeta(track);
  markAutoplayFile(track.file);
  await queueTrack(track);
}

/** Queues the prepared track in the current one's last ten seconds — or now, if past that. */
function enqueueNearEnd(run: number, track: TrackMeta): void {
  const queue = queueNow();
  const left = queue ? remainingMs(queue) : null;
  const wait = left === null ? 0 : Math.max(0, left - QUEUE_BEFORE_END_MS);
  timer = setTimeout(() => {
    timer = undefined;
    void enqueue(run, track).catch((error: unknown) =>
      container.logger?.warn('[autoplay] could not queue the next track:', error),
    );
  }, wait);
  timer.unref?.();
}

async function prepareNext(run: number): Promise<void> {
  const seeds = recent.slice(0, MAX_SEEDS);
  if (seeds.length === 0) {
    return;
  }

  const candidates = await relatedMusic(seeds, recent, ATTEMPTS);
  for (const candidate of candidates.slice(0, ATTEMPTS)) {
    if (run !== generation) {
      return;
    }
    const jobId = randomUUID();
    try {
      await submitMusicJob(jobId, candidate.query, { origin: 'autoplay', label: candidate.title });
      const job = await waitForJob(jobId);
      if (job.track) {
        enqueueNearEnd(run, job.track);
        return;
      }
    } catch (error) {
      container.logger?.warn('[autoplay] a suggested track could not be prepared:', error);
    }
  }
}

/** Looks at the queue again: starts preparing if autoplay should, stops if it should not. */
export function nudgeAutoplay(): void {
  const queue = queueNow();
  if (!wanted(queue) || !queue.currentTrack) {
    cancel();
    return;
  }

  cancel();
  const run = generation;
  void prepareNext(run).catch((error: unknown) =>
    container.logger?.info(
      '[autoplay] no next track:',
      error instanceof Error ? error.message : error,
    ),
  );
}

export function watchAutoplay(player: Player): void {
  player.events.on('playerStart', (_queue, track) => {
    remember(track);
    nudgeAutoplay();
  });
  // A track added by anyone wins over autoplay's pick; removing tracks may leave the
  // current one last again.
  player.events.on('audioTrackAdd', (_queue, track) => {
    if (!isAutoplayTrack(track)) {
      cancel();
    }
  });
  player.events.on('audioTracksAdd', () => cancel());
  player.events.on('audioTrackRemove', () => nudgeAutoplay());
  player.events.on('audioTracksRemove', () => nudgeAutoplay());
  player.events.on('queueDelete', () => {
    cancel();
    forgetAutoplayFiles();
  });
}

/** For local checks: forget everything, and use a fake queue and player. */
export function resetAutoplayForChecks(hooks: {
  queue: () => GuildQueue | undefined;
  play: (track: TrackMeta) => Promise<void>;
}): void {
  cancel();
  recent.length = 0;
  forgetAutoplayFiles();
  queueNow = hooks.queue;
  queueTrack = hooks.play;
}
