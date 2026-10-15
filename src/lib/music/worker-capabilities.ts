import { container } from '@sapphire/framework';

import { getEnv } from '../env.js';

/**
 * What the music worker says it can do beyond preparing tracks.
 *
 * A worker may list optional features in its health answer
 * (`{ "status": "ok", "capabilities": ["search", "expand", "related"] }`, docs/music-backend.md); the
 * bot then shows only the controls for those. The bot knows features by name and nothing
 * about how a worker provides them. A worker that sends no list is "unknown": every
 * control shows, and one the worker lacks answers that it is not available.
 */

export type WorkerCapability = 'search' | 'expand' | 'related';

const KNOWN = new Set<string>(['search', 'expand', 'related'] satisfies WorkerCapability[]);

const REFRESH_MS = 5 * 60 * 1000;
/** At start the worker may still be coming up next to the bot: ask again soon, a few times. */
const START_RETRY_MS = 10_000;
const START_RETRIES = 6;

let known: Set<string> | null = null;
let lastLogged: string | undefined;

/** Reads the health answer; false when the worker could not be reached. */
async function readCapabilities(): Promise<boolean> {
  try {
    const response = await fetch(`${getEnv().musicWorkerUrl}/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const body = (await response.json().catch(() => null)) as { capabilities?: unknown } | null;
    const list = body?.capabilities;
    known = Array.isArray(list)
      ? new Set(list.filter((item): item is string => typeof item === 'string'))
      : null;
    return true;
  } catch {
    // Unreachable just now: keep what was known.
    return false;
  }
}

/** Logs what is known — only when it changed, so the five-minute reads stay quiet. */
function report(reached: boolean, retrying = false): void {
  const line = !reached
    ? `unreachable${retrying ? ', retrying' : ''}`
    : known === null
      ? 'not stated'
      : [...known].join(', ') || 'none';
  if (line !== lastLogged) {
    lastLogged = line;
    container.logger?.info(`[music] worker capabilities: ${line}`);
  }
}

/** True when the worker offers it — or when the worker does not say. */
export function hasCapability(name: WorkerCapability): boolean {
  return known === null || known.has(name);
}

/** For the dashboard: the known list, or null when the worker does not say. */
export function workerCapabilities(): WorkerCapability[] | null {
  return known === null
    ? null
    : ([...known].filter((item) => KNOWN.has(item)) as WorkerCapability[]);
}

/** Reads now (again every ten seconds for a minute while unreachable), then every five minutes. */
export function startCapabilityWatch(): void {
  const first = async (attempt: number): Promise<void> => {
    const reached = await readCapabilities();
    const retrying = !reached && attempt < START_RETRIES;
    report(reached, retrying);
    if (retrying) {
      setTimeout(() => void first(attempt + 1), START_RETRY_MS).unref();
    }
  };

  void first(1);
  setInterval(() => void readCapabilities().then((reached) => report(reached)), REFRESH_MS).unref();
}

/** Sets the list directly — for local checks only. */
export function setCapabilitiesForChecks(list: string[] | null): void {
  known = list === null ? null : new Set(list);
}
