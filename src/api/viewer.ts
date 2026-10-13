import type { Context } from 'hono';

import type { PlaylistViewer } from '../lib/music/playlists/types.js';
import type { DashboardIdentity } from './auth/dashboard.js';

/** The dashboard user as a playlist viewer. */
export function dashboardPlaylistViewer(c: Context): PlaylistViewer {
  const identity = c.get('identity') as DashboardIdentity | undefined;
  return { name: identity?.user ?? identity?.groups[0] ?? 'dashboard' };
}
