import { randomUUID } from 'node:crypto';

import { container } from '@sapphire/framework';
import { useMainPlayer, useQueue, type Track } from 'discord-player';

import {
  getJob,
  markRetried,
  registerJob,
  resolveFailed,
  waitForJob,
  type JobOptions,
  type JobRecord,
  type TrackMeta,
} from '../../api/jobs/pending-registry.js';
import { enqueueMusicJob } from './backend-client.js';
import { describeFailure } from './failure-codes.js';
import { toLocalPlayQuery } from './local-file-extractor.js';
import { PLAYER_NODE_OPTIONS } from './player-node-options.js';
import { ensureBotVoiceChannel } from './voice-connection.js';

const trackMetaByFile = new Map<string, TrackMeta>();

// WHY a cap: an entry is consumed when the player loads the file, so a track that
// never got played (its play call failed, or it was prepared after a timeout) would
// otherwise stay for the life of the process. Far more than any queue holds.
const TRACK_META_KEEP = 200;

function rememberTrackMeta(track: TrackMeta): void {
  trackMetaByFile.delete(track.file);
  trackMetaByFile.set(track.file, track);
  while (trackMetaByFile.size > TRACK_META_KEEP) {
    const oldest = trackMetaByFile.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    trackMetaByFile.delete(oldest);
  }
}

export function getTrackMeta(file: string): TrackMeta | undefined {
  return trackMetaByFile.get(file);
}

export function consumeTrackMeta(file: string): TrackMeta | undefined {
  const meta = trackMetaByFile.get(file);
  trackMetaByFile.delete(file);
  return meta;
}

export async function submitMusicJob(
  jobId: string,
  query: string,
  options: JobOptions = {},
): Promise<JobRecord> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Provide something to play.');
  }

  registerJob(jobId, trimmed, options);
  try {
    await enqueueMusicJob(jobId, trimmed);
  } catch (error) {
    // Ended here, once, for every caller: a command's job used to stay pending when
    // the worker could not be reached.
    resolveFailed(
      jobId,
      error instanceof Error ? error.message : 'Music service is unavailable.',
      'unavailable',
    );
    throw error;
  }
  return getJob(jobId)!;
}

/**
 * Puts a prepared file at the front of the queue, the way `!playnext` does. Returns
 * the inserted track, or null when nothing is playing — then there is no "next" to
 * jump ahead of, and the caller plays it the ordinary way instead.
 */
export async function insertNextIfPlaying(guildId: string, file: string): Promise<Track | null> {
  const queue = useQueue(guildId);
  if (!queue?.currentTrack) {
    return null;
  }

  const search = await useMainPlayer().search(toLocalPlayQuery(file));
  const track = search.tracks[0];
  if (!track) {
    throw new Error('No tracks were found for that query.');
  }

  queue.node.insert(track, 0);
  return track;
}

async function playPreparedTrack(track: TrackMeta, next: boolean): Promise<void> {
  const { guild, voiceChannel } = await ensureBotVoiceChannel();

  // Checked when the file is ready, not when it was asked for: the track that was
  // playing then may have ended while the worker prepared this one.
  if (next && (await insertNextIfPlaying(guild.id, track.file))) {
    return;
  }

  const player = useMainPlayer();
  const playQuery = toLocalPlayQuery(track.file);
  await player.play(voiceChannel as unknown as Parameters<typeof player.play>[0], playQuery, {
    nodeOptions: PLAYER_NODE_OPTIONS,
  });
}

export function schedulePlayWhenReady(jobId: string, options: { next?: boolean } = {}): void {
  void (async () => {
    const job = await waitForJob(jobId);
    if (!job.track) {
      throw new Error(job.error ?? 'Failed to prepare track.');
    }

    rememberTrackMeta(job.track);
    await playPreparedTrack(job.track, options.next === true);
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Failed to play prepared track.';
    const current = getJob(jobId);
    if (current?.status === 'cancelled') {
      return;
    }
    container.logger.error('[dashboard-play]', error);
    if (current?.status === 'pending') {
      resolveFailed(jobId, message);
    }
  });
}

export async function prepareTrack(
  query: string,
  options: { next?: boolean } = {},
): Promise<TrackMeta> {
  const jobId = randomUUID();
  let job: JobRecord;
  try {
    await submitMusicJob(jobId, query, { origin: 'command', next: options.next });
    job = await waitForJob(jobId);
  } catch (error) {
    // The command answers with what the failure means, not only the worker's words.
    const failed = getJob(jobId);
    throw new Error(
      failed && failed.status !== 'pending'
        ? describeFailure(failed.code, failed.error)
        : error instanceof Error
          ? error.message
          : 'Failed to prepare track.',
      { cause: error },
    );
  }

  if (!job.track) {
    throw new Error(job.error ?? 'Failed to prepare track.');
  }

  rememberTrackMeta(job.track);
  return job.track;
}

/**
 * Asks the worker again for a failed or cancelled job's query, as a new job. The
 * retry plays through the dashboard path whatever the original came from — the
 * command that asked first has long since answered — and keeps "play next".
 */
export async function retryMusicJob(original: JobRecord): Promise<JobRecord> {
  const retryId = randomUUID();
  markRetried(original.jobId, retryId);
  const job = await submitMusicJob(retryId, original.query, {
    origin: 'dashboard',
    next: original.next,
    retryOf: original.jobId,
  });
  schedulePlayWhenReady(retryId, { next: original.next });
  return job;
}
