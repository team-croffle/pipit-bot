import { container } from '@sapphire/framework';

import { getEnv } from '../env.js';

/**
 * What the music worker says it can do beyond preparing tracks.
 *
 * A worker may list optional features in its health answer
 * (`{ "status": "ok", "capabilities": ["search", "expand"] }`, docs/music-backend.md); the
 * bot then shows only the controls for those. The bot knows features by name and nothing
 * about how a worker provides them. A worker that sends no list is "unknown": every
 * control shows, and one the worker lacks answers that it is not available.
 */

export type WorkerCapability = 'search' | 'expand';

const REFRESH_MS = 5 * 60 * 1000;

let known: Set<string> | null = null;

async function readCapabilities(): Promise<void> {
  try {
    const response = await fetch(`${getEnv().musicWorkerUrl}/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const body = (await response.json().catch(() => null)) as { capabilities?: unknown } | null;
    const list = body?.capabilities;
    known = Array.isArray(list)
      ? new Set(list.filter((item): item is string => typeof item === 'string'))
      : null;
  } catch {
    // Unreachable just now: keep what was known.
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
    : ([...known].filter((item) => item === 'search' || item === 'expand') as WorkerCapability[]);
}

/** Reads now and every five minutes. */
export function startCapabilityWatch(): void {
  void readCapabilities().then(() => {
    container.logger?.info(
      `[music] worker capabilities: ${known === null ? 'not stated' : [...known].join(', ') || 'none'}`,
    );
  });
  setInterval(() => void readCapabilities(), REFRESH_MS).unref();
}

/** Sets the list directly — for local checks only. */
export function setCapabilitiesForChecks(list: string[] | null): void {
  known = list === null ? null : new Set(list);
}
