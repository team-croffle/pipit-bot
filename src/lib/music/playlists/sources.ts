import { getGuildQueue } from '../playback.js';
import { getCandidate, PICK_PROBLEM_MESSAGE } from '../search-results.js';
import { sourceOf } from '../track-source.js';
import { PlaylistError } from './store.js';
import type { PlaylistItem } from './types.js';

/** Where a track to save comes from. */
export type ItemSource =
  | { from: 'current' }
  | { from: 'queue'; ref: { id: string } | { index: number } | 'all' }
  | { from: 'recent'; ref: { id: string } | { index: number } }
  | { from: 'search'; searchId: string; index: number; owner: string }
  | { from: 'typed'; query: string };

type NewItem = Omit<PlaylistItem, 'id'>;

const CANNOT_SAVE =
  'That track cannot be saved: the bot no longer knows what it was asked for (it played before a restart).';

function fromTrack(track: { url: string; title?: string } | undefined | null): NewItem {
  const source = track ? sourceOf(track) : undefined;
  if (!source) {
    throw new PlaylistError(409, CANNOT_SAVE);
  }
  return { title: source.title, durationSec: source.durationSec, query: source.query };
}

function pick<T extends { id: string }>(
  store: readonly T[],
  ref: { id: string } | { index: number },
): T | undefined {
  return 'id' in ref ? store.find((track) => track.id === ref.id) : store[ref.index - 1];
}

/**
 * Turns a source into playlist items. Queue and recent references follow the commands'
 * convention: an id from the dashboard, a 1-based position from Discord.
 */
export function resolveItems(source: ItemSource): NewItem[] {
  if (source.from === 'typed') {
    const query = source.query.trim();
    if (!query || query.length > 500) {
      throw new PlaylistError(400, 'Type a song title or a link (up to 500 characters).');
    }
    return [{ title: query, query, typed: true }];
  }

  if (source.from === 'search') {
    const found = getCandidate(source.searchId, source.index, source.owner);
    if ('problem' in found) {
      throw new PlaylistError(
        found.problem === 'not-yours' ? 403 : 409,
        PICK_PROBLEM_MESSAGE[found.problem],
      );
    }
    const { title, durationSec, query } = found.candidate;
    return [{ title, durationSec, query }];
  }

  const queue = getGuildQueue();
  if (!queue) {
    throw new PlaylistError(409, 'Nothing is playing.');
  }

  if (source.from === 'current') {
    if (!queue.currentTrack) {
      throw new PlaylistError(409, 'Nothing is playing.');
    }
    return [fromTrack(queue.currentTrack)];
  }

  if (source.from === 'queue') {
    if (source.ref === 'all') {
      const items = queue.tracks.store
        .map((track) => (sourceOf(track) ? fromTrack(track) : null))
        .filter((item): item is NewItem => item !== null);
      if (items.length === 0) {
        throw new PlaylistError(409, 'No track in the queue can be saved.');
      }
      return items;
    }
    const track = pick(queue.tracks.store, source.ref);
    if (!track) {
      throw new PlaylistError(404, 'That track is no longer in the queue.');
    }
    return [fromTrack(track)];
  }

  const track = pick(queue.history.tracks.store, source.ref);
  if (!track) {
    throw new PlaylistError(404, 'That track is no longer in the recent list.');
  }
  return [fromTrack(track)];
}
