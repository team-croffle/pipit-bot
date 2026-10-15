import { getEnv } from '../env.js';
import { SearchFailure, type SearchCandidate } from './search-client.js';

/** Most recent tracks sent as the ground for "what comes next", newest first. */
export const MAX_SEEDS = 5;
/** Recently played tracks the worker should not offer again. */
export const MAX_EXCLUDE = 50;
export const MAX_RELATED = 5;
/** Asked while a track is still playing; an answer that takes longer is not worth waiting for. */
const RELATED_TIMEOUT_MS = 10_000;

/**
 * Asks the music worker for tracks to play after the given ones (docs/music-backend.md,
 * optional) — for autoplay. What counts as a fitting next track is entirely the worker's
 * call; the bot sends the requests behind recent tracks untouched and takes the answers as
 * they come. Like search results, the answers' `query` values stay on the server.
 */
export async function relatedMusic(
  seeds: string[],
  exclude: string[],
  limit = MAX_RELATED,
): Promise<SearchCandidate[]> {
  const { musicWorkerUrl } = getEnv();
  let response: Response;
  try {
    response = await fetch(`${musicWorkerUrl}/v1/related`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seeds: seeds.slice(0, MAX_SEEDS),
        exclude: exclude.slice(0, MAX_EXCLUDE),
        limit: Math.min(Math.max(limit, 1), MAX_RELATED),
      }),
      signal: AbortSignal.timeout(RELATED_TIMEOUT_MS),
    });
  } catch {
    throw new SearchFailure('unavailable', 'The music worker is unavailable.');
  }

  if (response.status === 404 || response.status === 405 || response.status === 501) {
    throw new SearchFailure('unsupported', 'The music worker does not offer autoplay.');
  }
  if (!response.ok) {
    const kind =
      response.status === 400 ? 'rejected' : response.status === 503 ? 'unavailable' : 'internal';
    throw new SearchFailure(kind, 'The music worker could not suggest a next track.');
  }

  const body = (await response.json().catch(() => null)) as { items?: unknown } | null;
  const items = Array.isArray(body?.items) ? body.items : [];
  return items
    .filter(
      (item): item is SearchCandidate =>
        typeof item?.title === 'string' && typeof item?.query === 'string' && item.query !== '',
    )
    .slice(0, MAX_RELATED)
    .map((item) => ({
      title: item.title.slice(0, 200),
      durationSec:
        typeof item.durationSec === 'number' && item.durationSec > 0 ? item.durationSec : undefined,
      query: item.query,
    }));
}
