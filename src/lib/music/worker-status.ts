import { container } from '@sapphire/framework';

import { getEnv } from '../env.js';
import { applyHealthAnswer } from './worker-capabilities.js';

/**
 * Whether the music worker can be reached, read from its health answer.
 *
 * WHY a status and not retries: a request made while the worker restarts used to end
 * as "unavailable" with nothing learned, and the next request failed the same way.
 * Retrying each request would only pile calls onto a worker that is down. Instead the
 * bot keeps one answer to "is the worker there?" — read often while it is not, rarely
 * while it is, and at once when a request could not reach it — so the banner, the
 * dashboard and command replies can say the worker is down, and stop saying so on
 * their own once it is back. Requests are still sent while it is down: one that
 * reaches a worker that has just come back succeeds without waiting for the next read.
 *
 * Only a 200 counts as reached: a worker answering its health check with anything else
 * is not ready to take jobs. Kept in memory only; after a restart the bot asks again.
 */

export type WorkerReachability = 'unknown' | 'up' | 'down';

export interface WorkerStatus {
  status: WorkerReachability;
  /** When the current status began; null until the first read. */
  since: number | null;
  /** When the worker was last asked. */
  checkedAt: number | null;
}

type Listener = (status: WorkerStatus) => void;

const timing = {
  /** Reached: the occasional read that also refreshes the capability list. */
  upMs: 5 * 60 * 1000,
  /** Down: 10 seconds first, doubling up to a minute. */
  downFirstMs: 10_000,
  downMaxMs: 60_000,
  /** A burst of failed requests asks once. */
  failureGapMs: 2000,
  healthTimeoutMs: 5000,
};

let current: WorkerStatus = { status: 'unknown', since: null, checkedAt: null };
let downDelay = timing.downFirstMs;
let timer: NodeJS.Timeout | undefined;
let inFlight: Promise<void> | undefined;
let watching = false;
const listeners = new Set<Listener>();

async function reachable(): Promise<boolean> {
  try {
    const response = await fetch(`${getEnv().musicWorkerUrl}/v1/health`, {
      signal: AbortSignal.timeout(timing.healthTimeoutMs),
    });
    if (!response.ok) {
      return false;
    }

    applyHealthAnswer(await response.json().catch(() => null));
    return true;
  } catch {
    return false;
  }
}

/** Records a status; listeners and the log hear only about changes. */
function apply(status: WorkerReachability, at: number): void {
  const changed = status !== current.status;
  current = { status, since: changed ? at : current.since, checkedAt: at };
  if (!changed) {
    return;
  }

  if (status === 'down') {
    container.logger?.warn('[music] worker unreachable — checking again with backoff');
  } else if (status === 'up') {
    container.logger?.info('[music] worker reachable');
  }

  for (const listener of listeners) {
    try {
      listener(current);
    } catch (error) {
      container.logger?.error('[music] worker status listener failed:', error);
    }
  }
}

/** One timer at a time: the next read replaces whatever was waiting. */
function schedule(): void {
  if (!watching) {
    return;
  }

  clearTimeout(timer);
  let delay = timing.upMs;
  if (current.status === 'up') {
    downDelay = timing.downFirstMs;
  } else {
    delay = downDelay;
    downDelay = Math.min(downDelay * 2, timing.downMaxMs);
  }

  timer = setTimeout(() => void check(), delay);
  timer.unref();
}

function check(): Promise<void> {
  inFlight ??= (async () => {
    try {
      apply((await reachable()) ? 'up' : 'down', Date.now());
    } finally {
      inFlight = undefined;
      schedule();
    }
  })();
  return inFlight;
}

export function getWorkerStatus(): WorkerStatus {
  return current;
}

/** Called on every change of status; returns the way to stop listening. */
export function onWorkerStatusChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * A request could not reach the worker: ask now instead of at the next scheduled read.
 * A read already under way is shared, and one just made is trusted, so a burst of
 * failures costs one health request.
 */
export function noteWorkerFailure(): Promise<void> {
  if (inFlight) {
    return inFlight;
  }

  if (current.checkedAt !== null && Date.now() - current.checkedAt < timing.failureGapMs) {
    return Promise.resolve();
  }

  return check();
}

/** Reads now, then keeps reading on the schedule above. */
export function startWorkerWatch(): void {
  if (watching) {
    return;
  }

  watching = true;
  void check();
}

/** Sets the status directly — for local checks only. */
export function setWorkerStatusForChecks(status: WorkerReachability): void {
  apply(status, Date.now());
}

/** Shortens the schedule — for local checks only. */
export function setWorkerTimingForChecks(overrides: Partial<typeof timing>): void {
  Object.assign(timing, overrides);
  downDelay = timing.downFirstMs;
}
