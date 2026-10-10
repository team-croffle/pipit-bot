import type { JobRecord, JobStatus } from '@/types';

/** How the jobs card names a job's state and failure — the server sends codes, not copy. */

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  pending: '준비 중',
  ready: '준비됨',
  failed: '실패',
  cancelled: '취소됨',
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
  'not-found': '음악 워커가 찾지 못했습니다',
  rejected: '음악 워커가 요청을 거절했습니다',
  unavailable: '음악 워커에 연결할 수 없습니다',
  timeout: '준비 시간이 초과되었습니다',
  internal: '음악 워커에서 오류가 났습니다',
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

  const summary = job.code ? REASON[job.code] : undefined;
  if (!summary) {
    return { summary: job.error ?? '실패했습니다', detail: '' };
  }

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
