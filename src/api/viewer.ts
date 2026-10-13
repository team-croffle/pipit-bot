import type { Context } from 'hono';

import { getGithubNotifySettings } from '../lib/github/settings.js';
import type { PlaylistViewer } from '../lib/music/playlists/types.js';
import type { DashboardIdentity } from './auth/dashboard.js';

/**
 * The Discord user behind a dashboard user, through the GitHub page's account links.
 *
 * WHY there: the dashboard signs in through the identity provider, whose user name is
 * the person's GitHub login (Dex with the GitHub connector), and the GitHub page already
 * links GitHub logins to Discord users for mentions. Without a link, the person simply
 * has no Discord identity on the dashboard.
 */
export function discordIdOf(identity: DashboardIdentity | undefined | null): string | undefined {
  const user = identity?.user?.toLowerCase();
  if (!user) {
    return undefined;
  }

  return getGithubNotifySettings().accounts.find(
    (account) => account.githubLogin.toLowerCase() === user,
  )?.discordUserId;
}

/** The dashboard user as a playlist viewer. */
export function dashboardPlaylistViewer(c: Context): PlaylistViewer {
  const identity = c.get('identity') as DashboardIdentity | undefined;
  return {
    discordId: discordIdOf(identity),
    name: identity?.user ?? identity?.groups[0] ?? 'dashboard',
  };
}
