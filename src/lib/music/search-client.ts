import { getEnv } from '../env.js';

/** One search result as the worker gives it. `query` is opaque: sent back unchanged as a job query. */
export interface SearchCandidate {
  title: string;
  durationSec?: number;
  query: string;
}

export type SearchFailureKind = 'unsupported' | 'rejected' | 'unavailable' | 'internal';

export class SearchFailure extends Error {
  readonly kind: SearchFailureKind;

  constructor(kind: SearchFailureKind, message: string) {
    super(message);
    this.name = 'SearchFailure';
    this.kind = kind;
  }
}

export const MAX_SEARCH_RESULTS = 5;
/** The worker answers within 10 s; a little more for the network. */
const SEARCH_TIMEOUT_MS = 12_000;

const MESSAGES: Record<SearchFailureKind, string> = {
  unsupported: 'The music worker does not offer search.',
  rejected: 'The music worker cannot search for that.',
  unavailable: 'The music worker is unavailable.',
  internal: 'The music worker could not search.',
};

function readCandidates(body: unknown): SearchCandidate[] {
  const results = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) {
    throw new SearchFailure('internal', MESSAGES.internal);
  }

  return results
    .filter(
      (item): item is SearchCandidate =>
        typeof item?.title === 'string' && typeof item?.query === 'string' && item.query !== '',
    )
    .slice(0, MAX_SEARCH_RESULTS)
    .map((item) => ({
      title: item.title.slice(0, 200),
      durationSec:
        typeof item.durationSec === 'number' && item.durationSec > 0 ? item.durationSec : undefined,
      query: item.query,
    }));
}

/**
 * Asks the music worker for up to five candidates (docs/music-backend.md). The query is
 * passed on untouched, and the candidates' `query` values are never read — only kept,
 * to be sent back as a job query when someone picks one.
 */
export async function searchMusic(
  query: string,
  limit = MAX_SEARCH_RESULTS,
): Promise<SearchCandidate[]> {
  const { musicWorkerUrl } = getEnv();
  let response: Response;
  try {
    response = await fetch(`${musicWorkerUrl}/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: Math.min(limit, MAX_SEARCH_RESULTS) }),
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
  } catch {
    throw new SearchFailure('unavailable', MESSAGES.unavailable);
  }

  if (response.status === 404 || response.status === 405 || response.status === 501) {
    throw new SearchFailure('unsupported', MESSAGES.unsupported);
  }

  if (!response.ok) {
    const kind: SearchFailureKind =
      response.status === 400 ? 'rejected' : response.status === 503 ? 'unavailable' : 'internal';
    throw new SearchFailure(kind, MESSAGES[kind]);
  }

  return readCandidates(await response.json().catch(() => null));
}
