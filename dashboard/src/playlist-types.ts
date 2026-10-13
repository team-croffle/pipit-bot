/** Playlists as the dashboard sees them: titles and lengths, never the requests behind them. */
export type PlaylistScope = 'shared' | 'personal';

export interface PlaylistItem {
  id: string;
  title: string;
  durationSec?: number;
  typed: boolean;
  /** Only for a typed track: what was typed. */
  request?: string;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  scope: PlaylistScope;
  mine: boolean;
  createdBy: string;
  itemCount: number;
  totalSec: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistDetail extends PlaylistSummary {
  items: PlaylistItem[];
}

/** Where a track to save comes from (POST /api/playlists/:id/items). */
export type PlaylistItemSource =
  | { from: 'current' }
  | { from: 'queue'; ref: string | 'all' }
  | { from: 'recent'; ref: string }
  | { from: 'search'; searchId: string; index: number }
  | { from: 'typed'; query: string };
