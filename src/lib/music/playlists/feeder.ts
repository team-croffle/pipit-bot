import { randomUUID } from 'node:crypto';

import { container } from '@sapphire/framework';
import type { Player } from 'discord-player';

import { waitForJob, type TrackMeta } from '../../../api/jobs/pending-registry.js';
import type { Notice } from '../../discord/notice.js';
import { raisePlaybackNotice } from '../missing-file.js';
import { getGuildQueue } from '../playback.js';
import { playPreparedTrack, rememberTrackMeta, submitMusicJob } from '../prepare-track.js';
import { fileOfTrack } from '../track-source.js';
import { beginFeed, isCurrentFeed, setFeedStatus, stopFeed } from './feed-state.js';
import { retitleTypedItem } from './store.js';
import type { Playlist, PlaylistItem } from './types.js';

/**
 * Plays a playlist by feeding it into the queue a few tracks at a time.
 *
 * WHY not all at once: the music worker prepares two tracks at a time and the bot waits
 * two minutes for each — thirty tracks asked for together would have the last ones time
 * out. The feeder keeps at most AHEAD tracks prepared-but-not-started (being prepared, or
 * waiting in the queue) and asks for the next whenever one starts or fails.
 */
const AHEAD = 2;

interface Feed {
  generation: number;
  playlist: { id: string; name: string };
  pending: PlaylistItem[];
  total: number;
  inFlight: number;
  failed: number;
  /** Files this feed put in the queue that have not started yet. */
  files: Set<string>;
  requestedBy?: string;
  /** Order numbers: the next to hand out, and the next to put in the queue. */
  nextSeq: number;
  flushSeq: number;
  /** Finished preparations waiting for their turn — the queue keeps playlist order. */
  finished: Map<number, { item: PlaylistItem; track: TrackMeta } | 'failed'>;
  flushing: boolean;
}

let feed: Feed | null = null;

/** Tracks still waiting in the queue that this feed put there. */
function waitingInQueue(current: Feed): number {
  const queue = getGuildQueue();
  if (!queue) {
    return 0;
  }

  let count = 0;
  for (const track of queue.tracks.store) {
    const file = fileOfTrack(track);
    if (file && current.files.has(file)) {
      count += 1;
    }
  }
  return count;
}

function publish(current: Feed): void {
  setFeedStatus({
    playlistId: current.playlist.id,
    name: current.playlist.name,
    total: current.total,
    remaining: current.pending.length + current.inFlight,
    failed: current.failed,
  });
}

function finishIfDone(current: Feed): void {
  if (current.pending.length > 0 || current.inFlight > 0 || feed !== current) {
    return;
  }

  feed = null;
  setFeedStatus(null);
  if (current.failed > 0) {
    raisePlaybackNotice(
      `${current.failed} of ${current.total} tracks of "${current.playlist.name}" could not be prepared and were skipped.`,
    );
  }
}

/**
 * Puts finished preparations into the queue in playlist order. Preparations finish in
 * any order (a long track takes longer), so a later one waits for those before it.
 */
async function flush(current: Feed): Promise<void> {
  if (current.flushing) {
    return;
  }

  current.flushing = true;
  try {
    while (isCurrentFeed(current.generation) && current.finished.has(current.flushSeq)) {
      const done = current.finished.get(current.flushSeq)!;
      current.finished.delete(current.flushSeq);
      current.flushSeq += 1;
      try {
        if (done === 'failed') {
          current.failed += 1;
          continue;
        }

        rememberTrackMeta(done.track);
        current.files.add(done.track.file);
        await playPreparedTrack(done.track, false, current.requestedBy);
        if (done.item.typed) {
          void retitleTypedItem(
            current.playlist.id,
            done.item.id,
            done.track.title,
            done.track.durationSec,
          );
        }
      } catch (error) {
        current.failed += 1;
        container.logger?.warn(
          `[playlist] a track of ${current.playlist.id} could not be queued:`,
          error,
        );
      } finally {
        current.inFlight -= 1;
      }
    }
  } finally {
    current.flushing = false;
  }
  pump(current);
}

async function prepareOne(current: Feed, item: PlaylistItem, seq: number): Promise<void> {
  const jobId = randomUUID();
  try {
    await submitMusicJob(jobId, item.query, { origin: 'dashboard', label: item.title });
    const job = await waitForJob(jobId);
    current.finished.set(seq, job.track ? { item, track: job.track } : 'failed');
  } catch (error) {
    current.finished.set(seq, 'failed');
    container.logger?.warn(`[playlist] a track of ${current.playlist.id} was skipped:`, error);
  }
  await flush(current);
}

/** Asks for more tracks while fewer than AHEAD are prepared-but-not-started. */
function pump(current: Feed): void {
  if (!isCurrentFeed(current.generation) || feed !== current) {
    return;
  }

  while (current.pending.length > 0 && current.inFlight + waitingInQueue(current) < AHEAD) {
    const item = current.pending.shift()!;
    current.inFlight += 1;
    void prepareOne(current, item, current.nextSeq);
    current.nextSeq += 1;
  }

  publish(current);
  finishIfDone(current);
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy;
}

/**
 * Starts playing a playlist at the end of the queue (after whatever is there). The bot
 * must already be in a voice channel. A playlist that was being fed stops being fed;
 * what it already put in the queue stays.
 */
export function playPlaylist(
  playlist: Playlist,
  options: { shuffle?: boolean; requestedBy?: string } = {},
): Notice {
  if (playlist.items.length === 0) {
    return { ok: false, message: `"${playlist.name}" has no tracks yet.` };
  }

  stopFeed();
  const items = options.shuffle ? shuffled(playlist.items) : [...playlist.items];
  const current: Feed = {
    generation: beginFeed(),
    playlist: { id: playlist.id, name: playlist.name },
    pending: items,
    total: items.length,
    inFlight: 0,
    failed: 0,
    files: new Set(),
    requestedBy: options.requestedBy,
    nextSeq: 0,
    flushSeq: 0,
    finished: new Map(),
    flushing: false,
  };
  feed = current;
  const total = items.length;
  pump(current);

  return {
    ok: true,
    message: `Playing "${playlist.name}"${options.shuffle ? ' shuffled' : ''} — ${total} track${total === 1 ? '' : 's'}.`,
  };
}

/** The feeder moves on whenever the queue moves: a track starts, ends, fails or is removed. */
export function watchPlaylistFeed(player: Player): void {
  const nudge = () => {
    if (feed) {
      pump(feed);
    }
  };
  player.events.on('playerStart', nudge);
  player.events.on('playerSkip', nudge);
  player.events.on('audioTrackRemove', nudge);
  player.events.on('audioTracksRemove', nudge);
  player.events.on('queueDelete', () => {
    feed = null;
    stopFeed();
  });
}
