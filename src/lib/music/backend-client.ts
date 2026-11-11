import { getEnv } from '../env.js';
import { reportUnreachable } from './worker-status.js';

/** The worker only accepts the job here (202) and prepares it later, so the answer is quick. */
const ENQUEUE_TIMEOUT_MS = 10_000;

/** Why a job could not be handed over, as a failure code (failure-codes.ts). */
export class EnqueueFailure extends Error {
  readonly code: 'unavailable' | 'rejected';

  constructor(code: 'unavailable' | 'rejected', message: string) {
    super(message);
    this.name = 'EnqueueFailure';
    this.code = code;
  }
}

export async function enqueueMusicJob(jobId: string, query: string): Promise<void> {
  const { musicWorkerUrl } = getEnv();
  let response: Response;

  try {
    response = await fetch(`${musicWorkerUrl}/v1/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, query }),
      signal: AbortSignal.timeout(ENQUEUE_TIMEOUT_MS),
    });
  } catch {
    throw new EnqueueFailure('unavailable', await reportUnreachable());
  }

  // A worker that answered with a 4xx is there; it only turned this job down.
  if (response.status >= 400 && response.status < 500) {
    throw new EnqueueFailure('rejected', 'The music worker refused the job.');
  }

  if (!response.ok) {
    throw new EnqueueFailure('unavailable', await reportUnreachable());
  }
}
