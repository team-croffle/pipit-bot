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
  /** A short machine-readable reason for a failure (`timeout` when the bot gave up waiting). */
  code?: string;
  /**
   * A worker answer that arrived after the job had already ended — timed out, most
   * often. Kept for the record; it does not reopen the job or play anything.
   */
  lateResult?: { status: 'ready' | 'failed'; track?: TrackMeta; error?: string; at: number };
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

/**
 * Finished jobs kept for the dashboard's list. WHY a cap: the registry used to keep
 * every job for the life of the process. Pending jobs are never dropped — something
 * may still be waiting on them.
 */
const FINISHED_KEEP = 100;

function prune(): void {
  const finished = [...jobs.values()]
    .filter((record) => record.status !== 'pending')
    .toSorted((a, b) => a.updatedAt - b.updatedAt);
  for (const record of finished.slice(0, Math.max(0, finished.length - FINISHED_KEEP))) {
    jobs.delete(record.jobId);
  }
}

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

/** Records an answer for a job that has already ended; returns true when it did. */
function recordLate(record: JobRecord, late: Omit<NonNullable<JobRecord['lateResult']>, 'at'>) {
  if (record.status === 'pending') {
    return false;
  }

  record.lateResult = { ...late, at: now() };
  return true;
}

function settle(record: JobRecord, settleWaiter: (waiter: PendingWaiter) => void): void {
  record.updatedAt = now();
  const waiter = waiters.get(record.jobId);
  if (waiter) {
    clearTimeout(waiter.timeout);
    waiters.delete(record.jobId);
    settleWaiter(waiter);
  }
  prune();
}

export function resolveReady(jobId: string, track: TrackMeta): JobRecord {
  const record = jobs.get(jobId) ?? registerJob(jobId, '');
  if (recordLate(record, { status: 'ready', track })) {
    return record;
  }

  record.status = 'ready';
  record.track = track;
  record.error = undefined;
  settle(record, (waiter) => waiter.resolve(record));
  return record;
}

export function resolveFailed(jobId: string, error: string, code?: string): JobRecord {
  const record = jobs.get(jobId) ?? registerJob(jobId, '');
  if (recordLate(record, { status: 'failed', error })) {
    return record;
  }

  record.status = 'failed';
  record.error = error;
  record.code = code;
  settle(record, (waiter) => waiter.reject(new Error(error)));
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
    // WHY the job is failed here and not just the wait: a job left pending kept the
    // playback state on "loading" for good, and the worker's eventual answer would
    // have looked like a success nobody acted on.
    const timeout = setTimeout(() => {
      waiters.delete(jobId);
      resolveFailed(jobId, 'Timed out preparing track.', 'timeout');
      reject(new Error('Timed out preparing track.'));
    }, timeoutMs);

    waiters.set(jobId, {
      resolve,
      reject,
      timeout,
    });
  });
}
