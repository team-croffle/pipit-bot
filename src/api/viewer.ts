import type { Context } from 'hono';

import { getAccountLinks } from '../lib/account-links.js';
import type { PlaylistViewer } from '../lib/music/playlists/types.js';
import { findUserById } from '../lib/users/store.js';
import type { DashboardIdentity } from './auth/dashboard.js';

/**
 * The Discord user behind a dashboard user.
 *
 * WHY two ways: a signed-in user is a row in `users`, whose Discord id an admin or a
 * Discord sign-in set. The name match is what came before users (the identity provider's
 * user name is the person's GitHub login with Dex's GitHub connector) and still finds the
 * person when only a name is known. Without either, the person has no Discord identity on
 * the dashboard.
 */
let accounts = () => getAccountLinks();

/** Replaces the account links read here — for local checks only. */
export function setAccountLinksForChecks(
  links: { githubLogin: string; discordUserId: string }[],
): void {
  accounts = () => links;
}

export function discordIdOf(identity: DashboardIdentity | undefined | null): string | undefined {
  const own = findUserById(identity?.userId)?.discordUserId;
  if (own) {
    return own;
  }

  const user = identity?.user?.toLowerCase();
  if (!user) {
    return undefined;
  }

  return accounts().find((account) => account.githubLogin.toLowerCase() === user)?.discordUserId;
}

/** The dashboard user as a playlist viewer. */
export function dashboardPlaylistViewer(c: Context): PlaylistViewer {
  const identity = c.get('identity') as DashboardIdentity | undefined;
  return {
    discordId: discordIdOf(identity),
    name: identity?.user ?? identity?.groups[0] ?? 'dashboard',
  };
}
