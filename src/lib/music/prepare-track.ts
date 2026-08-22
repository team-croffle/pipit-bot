import { randomUUID } from 'node:crypto';

import { registerJob, waitForJob, type TrackMeta } from '../../api/jobs/pending-registry.js';

import { enqueueMusicJob } from './backend-client.js';

const trackMetaByFile = new Map<string, TrackMeta>();

export function getTrackMeta(file: string): TrackMeta | undefined {
  return trackMetaByFile.get(file);
}

export function consumeTrackMeta(file: string): TrackMeta | undefined {
  const meta = trackMetaByFile.get(file);
  trackMetaByFile.delete(file);
  return meta;
}

export async function prepareTrack(query: string): Promise<TrackMeta> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Provide something to play.');
  }

  const jobId = randomUUID();
  registerJob(jobId, trimmed);
  await enqueueMusicJob(jobId, trimmed);

  const job = await waitForJob(jobId);
  if (!job.track) {
    throw new Error(job.error ?? 'Failed to prepare track.');
  }

  trackMetaByFile.set(job.track.file, job.track);
  return job.track;
}
