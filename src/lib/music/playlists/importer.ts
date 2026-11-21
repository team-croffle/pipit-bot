import { expandMusic } from '../expand-client.js';
import { SearchFailure } from '../search-client.js';
import { hasCapability } from '../worker-capabilities.js';
import { addItems, createPlaylist, getPlaylist, playlistError, PlaylistError } from './store.js';
import type { Playlist, PlaylistScope, PlaylistViewer } from './types.js';

export interface ImportResult {
  playlist: Playlist;
  added: number;
  skipped: number;
}

async function expand(query: string) {
  if (!hasCapability('expand')) {
    throw playlistError(409, 'noImport');
  }
  const text = query.trim();
  if (!text || text.length > 500) {
    throw playlistError(400, 'pasteLink');
  }

  let expanded;
  try {
    expanded = await expandMusic(text);
  } catch (error) {
    throw new PlaylistError(
      error instanceof SearchFailure && error.kind === 'rejected' ? 400 : 409,
      error instanceof Error ? error.message : 'Importing failed.',
    );
  }
  if (expanded.items.length === 0) {
    throw playlistError(409, 'nothingToImport');
  }
  return expanded;
}

/** Imports into an existing playlist the viewer may edit. */
export async function importInto(
  playlistId: string,
  query: string,
  viewer: PlaylistViewer,
): Promise<ImportResult> {
  getPlaylist(playlistId, viewer);
  const expanded = await expand(query);
  return addItems(playlistId, expanded.items, viewer);
}

/** Imports into a new playlist, named as given, else after what the worker called it. */
export async function importAsNew(
  input: { query: string; name?: string; scope: PlaylistScope },
  viewer: PlaylistViewer,
): Promise<ImportResult> {
  const expanded = await expand(input.query);
  const playlist = await createPlaylist(
    { name: input.name?.trim() || expanded.title || 'Imported', scope: input.scope },
    viewer,
  );
  return addItems(playlist.id, expanded.items, viewer);
}
