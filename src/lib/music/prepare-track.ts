import { randomUUID } from 'node:crypto';

import { container } from '@sapphire/framework';
import { useMainPlayer, useQueue, type Track } from 'discord-player';

import {
  getJob,
  registerJob,
  resolveFailed,
  waitForJob,
  type JobRecord,
  type TrackMeta,
} from '../../api/jobs/pending-registry.js';
import { enqueueMusicJob } from './backend-client.js';
import { toLocalPlayQuery } from './local-file-extractor.js';
import { PLAYER_NODE_OPTIONS } from './player-node-options.js';
import { ensureBotVoiceChannel } from './voice-connection.js';

const trackMetaByFile = new Map<string, TrackMeta>();

export function getTrackMeta(file: string): TrackMeta | undefined {
  return trackMetaByFile.get(file);
}

export function consumeTrackMeta(file: string): TrackMeta | undefined {
  const meta = trackMetaByFile.get(file);
  trackMetaByFile.delete(file);
  return meta;
}

export async function submitMusicJob(jobId: string, query: string): Promise<JobRecord> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Provide something to play.');
  }

  registerJob(jobId, trimmed);
  await enqueueMusicJob(jobId, trimmed);
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

    trackMetaByFile.set(job.track.file, job.track);
    await playPreparedTrack(job.track, options.next === true);
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Failed to play prepared track.';
    container.logger.error('[dashboard-play]', error);
    const current = getJob(jobId);
    if (current?.status === 'pending') {
      resolveFailed(jobId, message);
    }
  });
}

export async function prepareTrack(query: string): Promise<TrackMeta> {
  const jobId = randomUUID();
  await submitMusicJob(jobId, query);

  const job = await waitForJob(jobId);
  if (!job.track) {
    throw new Error(job.error ?? 'Failed to prepare track.');
  }

  trackMetaByFile.set(job.track.file, job.track);
  return job.track;
}
