import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { container } from '@sapphire/framework';

import { dataDir } from '../../constants.js';
import { getDb } from '../../db/client.js';
import { migrateFile } from '../../db/migrate-file.js';
import { say, type NoticeKey, type Phrase } from '../../i18n/phrase.js';
import { canEdit, canView } from './access.js';
import { deletePlaylistRow, readPlaylists, writePlaylist } from './storage.js';
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

  /** The message in other languages (i18n/phrase.ts); `message` stays English. */
  readonly phrase?: Phrase;

  constructor(status: 400 | 403 | 404 | 409, message: string, phrase?: Phrase) {
    super(message);
    this.name = 'PlaylistError';
    this.status = status;
    this.phrase = phrase;
  }
}

export function playlistError(
  status: 400 | 403 | 404 | 409,
  key: NoticeKey,
  params?: Record<string, string | number>,
): PlaylistError {
  const { message, phrase } = say(key, params);
  return new PlaylistError(status, message, phrase);
}

/**
 * In the database since v0.8.0 (`playlists`, `playlist_items`; the old
 * `data/playlists.json` is moved in once). The playlists stay in memory — the commands,
 * pickers and feeder read them without waiting — and every change writes the one
 * playlist it touched, one write after another. A failed write is logged, as a failed
 * file save was.
 */
let legacyPath = join(dataDir, 'playlists.json');
let playlists: Playlist[] = [];
let loadError: string | null = null;
let writing: Promise<void> = Promise.resolve();

/** Where an old playlists file is moved in from — for local checks only. */
export function setPlaylistsPathForChecks(path: string): void {
  legacyPath = path;
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
  const outcome = await migrateFile({
    name: 'playlists.json',
    path: legacyPath,
    label: 'playlists',
    parse,
    insert: async (tx, parsed) => {
      for (const playlist of parsed) {
        await writePlaylist(tx, playlist);
      }
      return parsed.length;
    },
  });
  loadError =
    outcome === 'broken'
      ? 'playlists.json is not valid and was not moved into the database; a copy was kept beside it. Fix the file and restart.'
      : null;

  playlists = await readPlaylists();
}

export function getPlaylistsLoadError(): string | null {
  return loadError;
}

function write(change: () => Promise<unknown>): Promise<void> {
  writing = writing
    .then(async () => {
      await change();
    })
    .catch((error: unknown) => {
      container.logger?.warn('[playlists] could not save:', error);
    });
  return writing;
}

/** Writes one playlist as it stands now (its tracks in their order). */
function save(playlist: Playlist): Promise<void> {
  const snapshot = structuredClone(playlist);
  return write(() => getDb().transaction((tx) => writePlaylist(tx, snapshot)));
}

const now = () => new Date().toISOString();

function cleanName(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim().replaceAll(/\s+/g, ' ') : '';
  if (!trimmed || trimmed.length > PLAYLIST_LIMITS.nameLength) {
    throw playlistError(400, 'nameLength', { max: PLAYLIST_LIMITS.nameLength });
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
    throw playlistError(409, 'nameTaken', { name });
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
    throw playlistError(404, 'playlistMissing');
  }
  return playlist;
}

function editable(id: string, viewer: PlaylistViewer): Playlist {
  const playlist = getPlaylist(id, viewer);
  if (!canEdit(playlist, viewer)) {
    throw playlistError(403, 'playlistNotYours');
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
    throw playlistError(409, 'personalNeedsDiscord');
  }
  if (playlists.length >= PLAYLIST_LIMITS.playlists) {
    throw playlistError(409, 'tooManyPlaylists', { max: PLAYLIST_LIMITS.playlists });
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
  await save(playlist);
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
  await save(playlist);
  return playlist;
}

export async function deletePlaylist(id: string, viewer: PlaylistViewer): Promise<Playlist> {
  const playlist = editable(id, viewer);
  playlists = playlists.filter((item) => item.id !== id);
  await write(() => deletePlaylistRow(id));
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
    throw playlistError(409, 'playlistFull', { max: PLAYLIST_LIMITS.items });
  }

  const accepted = items.slice(0, room).map((item) => ({ ...item, id: randomUUID().slice(0, 8) }));
  playlist.items.push(...accepted);
  playlist.updatedAt = now();
  await save(playlist);
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
    throw playlistError(404, 'notInPlaylist');
  }
  playlist.items.splice(index, 1);
  playlist.updatedAt = now();
  await save(playlist);
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
    throw playlistError(404, 'notInPlaylist');
  }
  const [item] = playlist.items.splice(from, 1);
  playlist.items.splice(Math.max(0, Math.min(Math.floor(to), playlist.items.length)), 0, item!);
  playlist.updatedAt = now();
  await save(playlist);
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
  const playlist = playlists.find((p) => p.id === playlistId);
  if (playlist) {
    await save(playlist);
  }
}
