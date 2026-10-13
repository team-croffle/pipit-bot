import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { container } from '@sapphire/framework';

import { dataDir } from '../../constants.js';
import { loadSettingsFile } from '../../settings-file.js';
import { canEdit, canView } from './access.js';
import {
  PLAYLIST_LIMITS,
  type Playlist,
  type PlaylistItem,
  type PlaylistScope,
  type PlaylistViewer,
} from './types.js';

/** A refusal with the HTTP status the API answers it with. */
export class PlaylistError extends Error {
  readonly status: 400 | 403 | 404 | 409;

  constructor(status: 400 | 403 | 404 | 409, message: string) {
    super(message);
    this.name = 'PlaylistError';
    this.status = status;
  }
}

let filePath = join(dataDir, 'playlists.json');
let playlists: Playlist[] = [];
let loadError: string | null = null;
let writing: Promise<void> = Promise.resolve();

export function setPlaylistsPathForChecks(path: string): void {
  filePath = path;
  playlists = [];
}

function parse(raw: unknown): Playlist[] {
  const list = (raw as { playlists?: unknown } | null)?.playlists;
  if (!Array.isArray(list)) {
    throw new Error('Expected { playlists: [...] }');
  }

  return list.filter(
    (item): item is Playlist =>
      typeof item?.id === 'string' &&
      typeof item?.name === 'string' &&
      (item.scope === 'shared' || item.scope === 'personal') &&
      Array.isArray(item.items),
  );
}

export async function loadPlaylists(): Promise<void> {
  const loaded = await loadSettingsFile({
    path: filePath,
    label: 'Playlists',
    parse,
    empty: () => [],
  });
  playlists = loaded.value;
  loadError = loaded.error;
}

export function getPlaylistsLoadError(): string | null {
  return loadError;
}

function save(): Promise<void> {
  const snapshot = `${JSON.stringify({ playlists }, null, 2)}\n`;
  writing = writing
    .then(async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, snapshot, 'utf8');
      loadError = null;
    })
    .catch((error: unknown) => {
      container.logger?.warn('[playlists] could not save:', error);
    });
  return writing;
}

const now = () => new Date().toISOString();

function cleanName(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim().replaceAll(/\s+/g, ' ') : '';
  if (!trimmed || trimmed.length > PLAYLIST_LIMITS.nameLength) {
    throw new PlaylistError(400, `A playlist name is 1–${PLAYLIST_LIMITS.nameLength} characters.`);
  }
  return trimmed;
}

function assertNameFree(
  name: string,
  scope: PlaylistScope,
  ownerId: string | undefined,
  except?: string,
) {
  const taken = playlists.some(
    (playlist) =>
      playlist.id !== except &&
      playlist.scope === scope &&
      playlist.ownerId === ownerId &&
      playlist.name.toLowerCase() === name.toLowerCase(),
  );
  if (taken) {
    throw new PlaylistError(409, `There is already a playlist called "${name}".`);
  }
}

/** Every playlist the viewer may see, shared first, then their own; newest change first. */
export function listPlaylists(viewer: PlaylistViewer): Playlist[] {
  return playlists
    .filter((playlist) => canView(playlist, viewer))
    .toSorted(
      (a, b) =>
        (a.scope === b.scope ? 0 : a.scope === 'shared' ? -1 : 1) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
}

/** A playlist the viewer may see; 404 otherwise (someone else's personal one included). */
export function getPlaylist(id: string, viewer: PlaylistViewer): Playlist {
  const playlist = playlists.find((item) => item.id === id);
  if (!playlist || !canView(playlist, viewer)) {
    throw new PlaylistError(404, 'That playlist does not exist.');
  }
  return playlist;
}

function editable(id: string, viewer: PlaylistViewer): Playlist {
  const playlist = getPlaylist(id, viewer);
  if (!canEdit(playlist, viewer)) {
    throw new PlaylistError(403, 'You cannot change that playlist.');
  }
  return playlist;
}

/** A playlist by name among those the viewer sees (Discord commands name them). */
export function findPlaylistByName(name: string, viewer: PlaylistViewer): Playlist | undefined {
  const wanted = name.trim().toLowerCase();
  return listPlaylists(viewer).find((playlist) => playlist.name.toLowerCase() === wanted);
}

export async function createPlaylist(
  input: { name: unknown; scope: PlaylistScope },
  viewer: PlaylistViewer,
): Promise<Playlist> {
  const name = cleanName(input.name);
  if (input.scope === 'personal' && !viewer.discordId) {
    throw new PlaylistError(
      409,
      'A personal playlist needs your Discord account: link your GitHub account to it on the GitHub page.',
    );
  }
  if (playlists.length >= PLAYLIST_LIMITS.playlists) {
    throw new PlaylistError(409, `There can be at most ${PLAYLIST_LIMITS.playlists} playlists.`);
  }

  const ownerId = input.scope === 'personal' ? viewer.discordId : undefined;
  assertNameFree(name, input.scope, ownerId);
  const playlist: Playlist = {
    id: randomUUID().slice(0, 8),
    name,
    scope: input.scope,
    ...(ownerId ? { ownerId } : {}),
    createdBy: { id: viewer.discordId, name: viewer.name },
    items: [],
    createdAt: now(),
    updatedAt: now(),
  };
  playlists.push(playlist);
  await save();
  return playlist;
}

export async function renamePlaylist(
  id: string,
  name: unknown,
  viewer: PlaylistViewer,
): Promise<Playlist> {
  const playlist = editable(id, viewer);
  const clean = cleanName(name);
  assertNameFree(clean, playlist.scope, playlist.ownerId, playlist.id);
  playlist.name = clean;
  playlist.updatedAt = now();
  await save();
  return playlist;
}

export async function deletePlaylist(id: string, viewer: PlaylistViewer): Promise<Playlist> {
  const playlist = editable(id, viewer);
  playlists = playlists.filter((item) => item.id !== id);
  await save();
  return playlist;
}

/** Adds items at the end; refuses what would pass the limit, and says how many fit. */
export async function addItems(
  id: string,
  items: Omit<PlaylistItem, 'id'>[],
  viewer: PlaylistViewer,
): Promise<{ playlist: Playlist; added: number; skipped: number }> {
  const playlist = editable(id, viewer);
  const room = PLAYLIST_LIMITS.items - playlist.items.length;
  if (room <= 0) {
    throw new PlaylistError(409, `A playlist holds at most ${PLAYLIST_LIMITS.items} tracks.`);
  }

  const accepted = items.slice(0, room).map((item) => ({ ...item, id: randomUUID().slice(0, 8) }));
  playlist.items.push(...accepted);
  playlist.updatedAt = now();
  await save();
  return { playlist, added: accepted.length, skipped: items.length - accepted.length };
}

export async function removeItem(
  id: string,
  itemId: string,
  viewer: PlaylistViewer,
): Promise<Playlist> {
  const playlist = editable(id, viewer);
  const index = playlist.items.findIndex((item) => item.id === itemId);
  if (index < 0) {
    throw new PlaylistError(404, 'That track is not in the playlist.');
  }
  playlist.items.splice(index, 1);
  playlist.updatedAt = now();
  await save();
  return playlist;
}

/** Moves an item to a 0-based position (past the end means last). */
export async function moveItem(
  id: string,
  itemId: string,
  to: number,
  viewer: PlaylistViewer,
): Promise<Playlist> {
  const playlist = editable(id, viewer);
  const from = playlist.items.findIndex((item) => item.id === itemId);
  if (from < 0) {
    throw new PlaylistError(404, 'That track is not in the playlist.');
  }
  const [item] = playlist.items.splice(from, 1);
  playlist.items.splice(Math.max(0, Math.min(Math.floor(to), playlist.items.length)), 0, item!);
  playlist.updatedAt = now();
  await save();
  return playlist;
}

/** Gives a typed item the worker's title once it has been prepared. */
export async function retitleTypedItem(
  playlistId: string,
  itemId: string,
  title: string,
  durationSec?: number,
): Promise<void> {
  const item = playlists.find((p) => p.id === playlistId)?.items.find((i) => i.id === itemId);
  if (!item?.typed || item.title === title) {
    return;
  }
  item.title = title;
  item.durationSec = durationSec ?? item.durationSec;
  await save();
}
