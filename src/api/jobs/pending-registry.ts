export type JobStatus = 'pending' | 'ready' | 'failed';

export interface TrackMeta {
  title: string;
  durationSec?: number;
  file: string;
}

export interface JobRecord {
  jobId: string;
  query: string;
  status: JobStatus;
  track?: TrackMeta;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface PendingWaiter {
  resolve: (record: JobRecord) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const jobs = new Map<string, JobRecord>();
const waiters = new Map<string, PendingWaiter>();

const DEFAULT_TIMEOUT_MS = 120_000;

function now(): number {
  return Date.now();
}

export function registerJob(jobId: string, query: string): JobRecord {
  const existing = jobs.get(jobId);
  if (existing) {
    return existing;
  }

  const record: JobRecord = {
    jobId,
    query,
    status: 'pending',
    createdAt: now(),
    updatedAt: now(),
  };
  jobs.set(jobId, record);
  return record;
}

export function getJob(jobId: string): JobRecord | undefined {
  return jobs.get(jobId);
}

export function listJobs(limit = 50): JobRecord[] {
  return [...jobs.values()].toSorted((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

export function resolveReady(jobId: string, track: TrackMeta): JobRecord {
  const record = jobs.get(jobId) ?? registerJob(jobId, '');
  record.status = 'ready';
  record.track = track;
  record.error = undefined;
  record.updatedAt = now();

  const waiter = waiters.get(jobId);
  if (waiter) {
    clearTimeout(waiter.timeout);
    waiters.delete(jobId);
    waiter.resolve(record);
  }

  return record;
}

export function resolveFailed(jobId: string, error: string): JobRecord {
  const record = jobs.get(jobId) ?? registerJob(jobId, '');
  record.status = 'failed';
  record.error = error;
  record.updatedAt = now();

  const waiter = waiters.get(jobId);
  if (waiter) {
    clearTimeout(waiter.timeout);
    waiters.delete(jobId);
    waiter.reject(new Error(error));
  }

  return record;
}

export function waitForJob(jobId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<JobRecord> {
  const record = jobs.get(jobId);
  if (record?.status === 'ready') {
    return Promise.resolve(record);
  }

  if (record?.status === 'failed') {
    return Promise.reject(new Error(record.error ?? 'Job failed'));
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      waiters.delete(jobId);
      reject(new Error('Timed out preparing track.'));
    }, timeoutMs);

    waiters.set(jobId, {
      resolve,
      reject,
      timeout,
    });
  });
}
