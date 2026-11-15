import { container } from '@sapphire/framework';
import type { GuildQueue, Player, Track } from 'discord-player';

import { isAutoplayTrack } from '../autoplay-files.js';
import { fileOfTrack, sourceOf } from '../track-source.js';
import {
  closeOpenPlays,
  finishPlay,
  recordPlayStart,
  sweepPlays,
  type PlayEndReason,
  type PlayOrigin,
} from './plays-store.js';
import { sweepTracks, upsertTrack } from './tracks-store.js';

/**
 * Writes the play history the recaps count: a row when a track starts, its end when it
 * stops playing.
 *
 * How a track ended, from the player's events: a skip announces itself before the
 * stream ends; a deleted queue (stop, leave) is a stop; the stream ending on its own is
 * a finish — unless it ended well short of the track's length, which is how a stop that
 * keeps the queue looks.
 *
 * Never in the way of playback: a write that fails is logged and the music goes on.
 */

/** Below this share of a known length, an end without a skip counts as a stop. */
const FINISHED_SHARE = 0.9;
const DAY_MS = 24 * 60 * 60 * 1000;

interface OpenPlay {
  /** Resolves to the row's id once it is written; null when the write failed. */
  row: Promise<number | null>;
  trackId: string;
  startedMs: number;
  durationSec?: number;
}

const open = new Map<string, OpenPlay>();
/** Files a playlist put in the queue (playlists/feeder.ts) — the feed itself may end first. */
const playlistFiles = new Set<string>();
const PLAYLIST_FILES_KEEP = 500;

export function notePlaylistFile(file: string): void {
  playlistFiles.delete(file);
  playlistFiles.add(file);
  while (playlistFiles.size > PLAYLIST_FILES_KEEP) {
    const oldest = playlistFiles.values().next().value;
    if (oldest === undefined) {
      break;
    }
    playlistFiles.delete(oldest);
  }
}

let recording = (): boolean => true;

/** Lets the recap settings switch the recording off (recap/settings.ts). */
export function setRecordingGate(gate: () => boolean): void {
  recording = gate;
}

function originOf(track: Track, file: string): PlayOrigin {
  if (isAutoplayTrack(track)) {
    return 'autoplay';
  }
  return playlistFiles.has(file) ? 'playlist' : 'request';
}

function durationOf(track: Track): number | undefined {
  const fromSource = sourceOf(track)?.durationSec;
  if (fromSource && fromSource > 0) {
    return fromSource;
  }
  const ms = track.durationMS;
  return ms > 0 ? Math.round(ms / 1000) : undefined;
}

function start(queue: GuildQueue, track: Track): void {
  const file = fileOfTrack(track);
  if (!file || !recording()) {
    return;
  }

  // A track that repeats starts again without a separate end.
  end(queue, 'finished');
  const at = new Date().toISOString();
  const durationSec = durationOf(track);
  const source = sourceOf(track);
  const requesterId = track.requestedBy?.id;
  const row = recordPlayStart({
    startedAt: at,
    guildId: queue.guild.id,
    fileKey: file,
    title: track.title,
    durationSec,
    origin: originOf(track, file),
    requesterId,
  }).catch((error: unknown) => {
    container.logger.warn('[recap] could not record a play:', error);
    return null;
  });
  open.set(queue.guild.id, { row, trackId: track.id, startedMs: Date.now(), durationSec });

  void upsertTrack({
    fileKey: file,
    title: track.title,
    durationSec,
    request: source?.query,
    at,
  }).catch((error: unknown) => container.logger.warn('[recap] could not note a track:', error));
}

function playedSeconds(queue: GuildQueue, play: OpenPlay): number {
  const fromPlayer = queue.node.playbackTime / 1000;
  const elapsed = (Date.now() - play.startedMs) / 1000;
  const played = fromPlayer > 0 ? fromPlayer : elapsed;
  return play.durationSec ? Math.min(played, play.durationSec) : played;
}

function end(queue: GuildQueue, reason: PlayEndReason, track?: Track): void {
  const play = open.get(queue.guild.id);
  if (!play || (track && track.id !== play.trackId)) {
    return;
  }

  open.delete(queue.guild.id);
  const played = playedSeconds(queue, play);
  const settled =
    reason === 'finished' && play.durationSec && played < play.durationSec * FINISHED_SHARE
      ? 'stopped'
      : reason;
  void play.row
    .then((id) => (id === null ? undefined : finishPlay(id, settled, played)))
    .catch((error: unknown) => container.logger.warn('[recap] could not end a play:', error));
}

export function watchPlays(player: Player): void {
  player.events.on('playerStart', (queue, track) => start(queue, track));
  player.events.on('playerSkip', (queue, track, reason) =>
    end(queue, reason === 'MANUAL' ? 'skipped' : 'error', track),
  );
  player.events.on('playerError', (queue, _error, track) => end(queue, 'error', track));
  player.events.on('playerFinish', (queue, track) => end(queue, 'finished', track));
  player.events.on('queueDelete', (queue) => end(queue, 'stopped'));
}

/** At start: closes what a restart left open, then sweeps old rows now and once a day. */
export function startPlayRetention(): void {
  const sweep = () => {
    void Promise.all([sweepPlays(), sweepTracks()])
      .then(([plays, tracks]) => {
        if (plays + tracks > 0) {
          container.logger.info(`[recap] removed ${plays} old plays and ${tracks} old tracks`);
        }
      })
      .catch((error: unknown) => container.logger.warn('[recap] could not sweep:', error));
  };

  void closeOpenPlays()
    .catch((error: unknown) => container.logger.warn('[recap] could not close plays:', error))
    .finally(sweep);
  setInterval(sweep, DAY_MS).unref();
}

/** For local checks: forget what is open. */
export function resetRecorderForChecks(): void {
  open.clear();
  playlistFiles.clear();
  recording = () => true;
}
