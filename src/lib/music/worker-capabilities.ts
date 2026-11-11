import { container } from '@sapphire/framework';

/**
 * What the music worker says it can do beyond preparing tracks.
 *
 * A worker may list optional features in its health answer
 * (`{ "status": "ok", "capabilities": ["search", "expand", "related"] }`, docs/music-backend.md); the
 * bot then shows only the controls for those. The bot knows features by name and nothing
 * about how a worker provides them. A worker that sends no list is "unknown": every
 * control shows, and one the worker lacks answers that it is not available.
 *
 * The health answer itself is read by worker-status.ts, which also tracks whether the
 * worker can be reached; an unreachable worker leaves the last known list in place.
 */

export type WorkerCapability = 'search' | 'expand' | 'related';

const KNOWN = new Set<string>(['search', 'expand', 'related'] satisfies WorkerCapability[]);

let known: Set<string> | null = null;
let lastLogged: string | undefined;

/** Takes the list from a health answer; logs it only when it changed, so routine reads stay quiet. */
export function applyHealthAnswer(body: unknown): void {
  const list = (body as { capabilities?: unknown } | null)?.capabilities;
  known = Array.isArray(list)
    ? new Set(list.filter((item): item is string => typeof item === 'string'))
    : null;

  const line = known === null ? 'not stated' : [...known].join(', ') || 'none';
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

/** Sets the list directly — for local checks only. */
export function setCapabilitiesForChecks(list: string[] | null): void {
  known = list === null ? null : new Set(list);
}
