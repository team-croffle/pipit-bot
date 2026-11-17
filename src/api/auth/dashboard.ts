import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';

import { getAuth } from '../../lib/auth/instance.js';
import type { EnvConfig } from '../../lib/env.js';
import { findUserById, reloadUser, type UserRow } from '../../lib/users/store.js';

export interface DashboardIdentity {
  /** The `users` row. */
  userId?: string;
  user: string | null;
  /** Every group the person is in: the identity provider's and the dashboard's. */
  groups: string[];
  /** Given by the identity provider at the last OIDC sign-in; only the provider changes them. */
  idpGroups: string[];
  /** Given on the dashboard's users page. */
  localGroups: string[];
  canWriteSettings: boolean;
  canControlPlayback: boolean;
}

/**
 * WHY admin is a group for everyone (2026-11-18, the team): the team already gives admin
 * through a GitHub team that the identity provider passes on as a group. Password,
 * Discord and GitHub users get the same group on the users page, so one rule —
 * `DASHBOARD_ADMIN_GROUPS` — decides for every way of signing in.
 */
export function isAdminGroup(groups: string[], adminGroups: string[]): boolean {
  const allowed = new Set(adminGroups.map((group) => group.toLowerCase()));
  return groups.some((group) => allowed.has(group.toLowerCase()));
}

export function identityOf(user: UserRow, config: EnvConfig): DashboardIdentity {
  const groups = [...new Set([...user.idpGroups, ...user.groups])];
  return {
    userId: user.id,
    user: user.username ?? user.name,
    groups,
    idpGroups: user.idpGroups,
    localGroups: user.groups,
    canWriteSettings: isAdminGroup(groups, config.dashboardAdminGroups),
    canControlPlayback: true,
  };
}

type Resolver = (config: EnvConfig, headers: Headers) => Promise<DashboardIdentity | null>;

async function fromSession(config: EnvConfig, headers: Headers): Promise<DashboardIdentity | null> {
  const auth = await getAuth(config);
  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session) {
    return null;
  }

  const user = findUserById(session.user.id) ?? (await reloadUser(session.user.id));
  return user ? identityOf(user, config) : null;
}

let resolve: Resolver = fromSession;

export function resolveDashboardIdentity(
  config: EnvConfig,
  headers: Headers,
): Promise<DashboardIdentity | null> {
  return resolve(config, headers);
}

/** Replaces how a request's identity is found — for local checks only. */
export function setIdentityResolverForChecks(next: Resolver | null): void {
  resolve = next ?? fromSession;
}

type IdentityVariables = { Variables: { config: EnvConfig; identity: DashboardIdentity } };

export async function identityFromContext(c: Context): Promise<DashboardIdentity | null> {
  return resolveDashboardIdentity(c.get('config') as EnvConfig, c.req.raw.headers);
}

export const dashboardViewer = createMiddleware<IdentityVariables>(async (c, next) => {
  const identity = await identityFromContext(c);
  if (!identity) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('identity', identity);
  return next();
});

export const dashboardWrite = createMiddleware<IdentityVariables>(async (c, next) => {
  const identity = c.get('identity');
  if (!identity.canWriteSettings) {
    return c.json({ error: 'Read-only: this action requires dashboard admin.' }, 403);
  }

  return next();
});
