/**
 * Playlists: saved lists of tracks, shared with the whole server or owned by one
 * Discord user.
 *
 * An item keeps the request that plays it (`query`). For a track that came from a
 * search, the current queue or an expanded link, that request is the music worker's own
 * value: it stays in the file and on the server, and only the title is shown. An item
 * someone typed (`typed`) may show what they typed.
 */

export type PlaylistScope = 'shared' | 'personal';

export interface PlaylistItem {
  id: string;
  title: string;
  durationSec?: number;
  query: string;
  /** Typed by a person — its request is their own words and may be shown back. */
  typed?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  scope: PlaylistScope;
  /** The Discord user a personal playlist belongs to. */
  ownerId?: string;
  createdBy: { id?: string; name: string };
  items: PlaylistItem[];
  createdAt: string;
  updatedAt: string;
}

/** Who is looking: a Discord user, or a dashboard user mapped to one (or not). */
export interface PlaylistViewer {
  discordId?: string;
  name: string;
}

export const PLAYLIST_LIMITS = {
  playlists: 200,
  items: 300,
  nameLength: 60,
} as const;

/** A playlist as a browser or a Discord message sees it: titles, never the worker's values. */
export interface PublicPlaylistItem {
  id: string;
  title: string;
  durationSec?: number;
  typed: boolean;
  /** Only for typed items: what was typed. */
  request?: string;
}

export interface PublicPlaylist {
  id: string;
  name: string;
  scope: PlaylistScope;
  mine: boolean;
  createdBy: string;
  itemCount: number;
  totalSec: number;
  items: PublicPlaylistItem[];
  createdAt: string;
  updatedAt: string;
}
