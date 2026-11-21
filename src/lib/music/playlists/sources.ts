import { getGuildQueue } from '../playback.js';
import { getCandidate, PICK_PROBLEM_KEY } from '../search-results.js';
import { sourceOf } from '../track-source.js';
import { playlistError } from './store.js';
import type { PlaylistItem } from './types.js';

/** Where a track to save comes from. */
export type ItemSource =
  | { from: 'current' }
  | { from: 'queue'; ref: { id: string } | { index: number } | 'all' }
  | { from: 'recent'; ref: { id: string } | { index: number } }
  | { from: 'search'; searchId: string; index: number; owner: string }
  | { from: 'typed'; query: string };

type NewItem = Omit<PlaylistItem, 'id'>;

function fromTrack(track: { url: string; title?: string } | undefined | null): NewItem {
  const source = track ? sourceOf(track) : undefined;
  if (!source) {
    throw playlistError(409, 'cannotSave');
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
      throw playlistError(400, 'typeTitleOrLink');
    }
    return [{ title: query, query, typed: true }];
  }

  if (source.from === 'search') {
    const found = getCandidate(source.searchId, source.index, source.owner);
    if ('problem' in found) {
      throw playlistError(
        found.problem === 'not-yours' ? 403 : 409,
        PICK_PROBLEM_KEY[found.problem],
      );
    }
    const { title, durationSec, query } = found.candidate;
    return [{ title, durationSec, query }];
  }

  const queue = getGuildQueue();
  if (!queue) {
    throw playlistError(409, 'nothingPlaying');
  }

  if (source.from === 'current') {
    if (!queue.currentTrack) {
      throw playlistError(409, 'nothingPlaying');
    }
    return [fromTrack(queue.currentTrack)];
  }

  if (source.from === 'queue') {
    if (source.ref === 'all') {
      const items = queue.tracks.store
        .map((track) => (sourceOf(track) ? fromTrack(track) : null))
        .filter((item): item is NewItem => item !== null);
      if (items.length === 0) {
        throw playlistError(409, 'nothingSavableInQueue');
      }
      return items;
    }
    const track = pick(queue.tracks.store, source.ref);
    if (!track) {
      throw playlistError(404, 'trackGone');
    }
    return [fromTrack(track)];
  }

  const track = pick(queue.history.tracks.store, source.ref);
  if (!track) {
    throw playlistError(404, 'notInRecent');
  }
  return [fromTrack(track)];
}
