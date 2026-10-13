import { getEnv } from '../env.js';
import { SearchFailure, type SearchCandidate } from './search-client.js';

/** What the music worker made of one request: an optional title and the tracks in it. */
export interface Expanded {
  title?: string;
  items: SearchCandidate[];
}

export const MAX_EXPANDED = 300;
/** Expanding can mean reading a long list; a person is waiting, but not for ever. */
const EXPAND_TIMEOUT_MS = 30_000;

/**
 * Asks the music worker to expand one request into several tracks (docs/music-backend.md,
 * optional). The request is passed on untouched and the bot never decides what kind of
 * request it is: a worker that sees nothing to expand answers an empty list. The items'
 * `query` values are kept on the server only, like search results.
 */
export async function expandMusic(query: string): Promise<Expanded> {
  const { musicWorkerUrl } = getEnv();
  let response: Response;
  try {
    response = await fetch(`${musicWorkerUrl}/v1/expand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(EXPAND_TIMEOUT_MS),
    });
  } catch {
    throw new SearchFailure('unavailable', 'The music worker is unavailable.');
  }

  if (response.status === 404 || response.status === 405 || response.status === 501) {
    throw new SearchFailure('unsupported', 'The music worker does not offer importing.');
  }
  if (!response.ok) {
    const kind =
      response.status === 400 ? 'rejected' : response.status === 503 ? 'unavailable' : 'internal';
    throw new SearchFailure(
      kind,
      kind === 'rejected'
        ? 'The music worker cannot import that.'
        : 'The music worker could not import that.',
    );
  }

  const body = (await response.json().catch(() => null)) as {
    title?: unknown;
    items?: unknown;
  } | null;
  const items = Array.isArray(body?.items) ? body.items : [];
  return {
    title:
      typeof body?.title === 'string' && body.title.trim()
        ? body.title.trim().slice(0, 60)
        : undefined,
    items: items
      .filter(
        (item): item is SearchCandidate =>
          typeof item?.title === 'string' && typeof item?.query === 'string' && item.query !== '',
      )
      .slice(0, MAX_EXPANDED)
      .map((item) => ({
        title: item.title.slice(0, 200),
        durationSec:
          typeof item.durationSec === 'number' && item.durationSec > 0
            ? item.durationSec
            : undefined,
        query: item.query,
      })),
  };
}
