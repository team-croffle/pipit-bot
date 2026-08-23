import { randomUUID } from 'node:crypto';

import { container } from '@sapphire/framework';
import { useMainPlayer } from 'discord-player';

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

async function playPreparedTrack(track: TrackMeta): Promise<void> {
  const { voiceChannel } = await ensureBotVoiceChannel();

  const player = useMainPlayer();
  const playQuery = toLocalPlayQuery(track.file);
  await player.play(voiceChannel as unknown as Parameters<typeof player.play>[0], playQuery, {
    nodeOptions: PLAYER_NODE_OPTIONS,
  });
}

export function schedulePlayWhenReady(jobId: string): void {
  void (async () => {
    const job = await waitForJob(jobId);
    if (!job.track) {
      throw new Error(job.error ?? 'Failed to prepare track.');
    }

    trackMetaByFile.set(job.track.file, job.track);
    await playPreparedTrack(job.track);
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
