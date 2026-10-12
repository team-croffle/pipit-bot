import { randomUUID } from 'node:crypto';

import type { SearchCandidate } from './search-client.js';

/**
 * Search results kept on the server while someone picks one.
 *
 * WHY: a candidate's `query` is the music worker's own value. It never goes to Discord
 * or the browser — they get a search id and an index, and the value is looked up here
 * when the pick arrives. Each search belongs to whoever ran it.
 */

const TTL_MS = 10 * 60 * 1000;
const MAX_SEARCHES = 200;

interface SavedSearch {
  owner: string;
  results: SearchCandidate[];
  expiresAt: number;
}

const searches = new Map<string, SavedSearch>();

export type PickProblem = 'missing' | 'expired' | 'not-yours';

export const PICK_PROBLEM_MESSAGE: Record<PickProblem, string> = {
  missing: 'That search result is no longer available. Search again.',
  expired: 'These search results have expired. Search again.',
  'not-yours': 'Only the person who searched can pick from these results.',
};

function prune(now: number): void {
  for (const [id, search] of searches) {
    if (search.expiresAt <= now) {
      searches.delete(id);
    }
  }

  // Oldest first, by insertion order.
  for (const id of searches.keys()) {
    if (searches.size <= MAX_SEARCHES) {
      break;
    }
    searches.delete(id);
  }
}

/** Keeps results for `owner` (a Discord user id or `dashboard:<name>`) and returns the search id. */
export function saveSearch(owner: string, results: SearchCandidate[], now = Date.now()): string {
  prune(now);
  // Short, so it fits a Discord custom id alongside its prefix.
  const id = randomUUID().replaceAll('-', '').slice(0, 12);
  searches.set(id, { owner, results, expiresAt: now + TTL_MS });
  return id;
}

export function getCandidate(
  searchId: string,
  index: number,
  owner: string,
  now = Date.now(),
): { candidate: SearchCandidate } | { problem: PickProblem } {
  const search = searches.get(searchId);
  if (!search) {
    return { problem: 'missing' };
  }

  if (search.expiresAt <= now) {
    searches.delete(searchId);
    return { problem: 'expired' };
  }

  if (search.owner !== owner) {
    return { problem: 'not-yours' };
  }

  const candidate = search.results[index];
  return candidate ? { candidate } : { problem: 'missing' };
}
