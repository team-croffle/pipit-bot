import { t } from '@/i18n';
import type { JobRecord, JobStatus } from '@/types';

/** How the jobs card names a job's state and failure — the server sends codes, not copy. */

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  // Getters, so a template reading them follows a change of language.
  get pending() {
    return t('music.jobs.status.pending');
  },
  get ready() {
    return t('music.jobs.status.ready');
  },
  get failed() {
    return t('music.jobs.status.failed');
  },
  get cancelled() {
    return t('music.jobs.status.cancelled');
  },
};

export const JOB_STATUS_VARIANT: Record<
  JobStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'secondary',
  ready: 'default',
  failed: 'destructive',
  cancelled: 'outline',
};

const REASON: Record<string, string> = {
  'not-found': 'notFound',
  rejected: 'rejected',
  unavailable: 'unavailable',
  timeout: 'timeout',
  internal: 'internal',
};

/** Codes the bot sets itself — their `error` text is the bot's own English, not news. */
const BOT_CODES = new Set(['unavailable', 'timeout']);

/** Failures a second try will not fix (docs/music-backend.md). */
const FINAL_CODES = new Set(['not-found', 'rejected']);

export interface JobReason {
  summary: string;
  /** The worker's own words, when they add something. */
  detail: string;
}

export function jobReason(job: JobRecord): JobReason | null {
  if (job.status !== 'failed') {
    return null;
  }

  const reason = job.code ? REASON[job.code] : undefined;
  if (!reason) {
    return { summary: job.error ?? t('music.jobs.failed'), detail: '' };
  }
  const summary = t(`music.jobs.reason.${reason}`);

  const detail = job.error && !BOT_CODES.has(job.code ?? '') ? job.error : '';
  return { summary, detail };
}

export function canCancel(job: JobRecord): boolean {
  return job.status === 'pending';
}

export function canRetry(job: JobRecord): boolean {
  if (job.retriedAs) {
    return false;
  }

  return (
    job.status === 'cancelled' || (job.status === 'failed' && !FINAL_CODES.has(job.code ?? ''))
  );
}
