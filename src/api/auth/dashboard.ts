import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';

import type { EnvConfig } from '../../lib/env.js';
import { parseSessionToken } from './session.js';

export interface DashboardIdentity {
  user: string | null;
  groups: string[];
  canWriteSettings: boolean;
  canControlPlayback: boolean;
}

function isAdminGroup(groups: string[], adminGroups: string[]): boolean {
  const allowed = new Set(adminGroups.map((group) => group.toLowerCase()));
  return groups.some((group) => allowed.has(group.toLowerCase()));
}

function withCapabilities(
  user: string | null,
  groups: string[],
  isAdmin: boolean,
): DashboardIdentity {
  return {
    user,
    groups,
    canWriteSettings: isAdmin,
    canControlPlayback: true,
  };
}

function devIdentity(config: EnvConfig): DashboardIdentity {
  const isAdmin = config.dashboardDevRole === 'admin';
  return withCapabilities(config.dashboardDevUser, isAdmin ? ['pipit-admins'] : [], isAdmin);
}

export function resolveDashboardIdentity(
  config: EnvConfig,
  sessionCookie: string | undefined,
): DashboardIdentity | null {
  if (config.oidc) {
    const session = parseSessionToken(sessionCookie, config.oidc.sessionSecret);
    if (!session) {
      return null;
    }

    const isAdmin = isAdminGroup(session.groups, config.dashboardAdminGroups);
    return withCapabilities(session.user, session.groups, isAdmin);
  }

  if (config.nodeEnv !== 'production') {
    return devIdentity(config);
  }

  return null;
}

function isIdentified(identity: DashboardIdentity): boolean {
  return Boolean(identity.user) || identity.groups.length > 0;
}

export const dashboardViewer = createMiddleware<{
  Variables: {
    config: EnvConfig;
    identity: DashboardIdentity;
  };
}>(async (c, next) => {
  const config = c.get('config');
  const identity = resolveDashboardIdentity(config, getCookie(c, 'pipit_session'));
  if (!identity || !isIdentified(identity)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('identity', identity);
  return next();
});

export const dashboardWrite = createMiddleware<{
  Variables: {
    config: EnvConfig;
    identity: DashboardIdentity;
  };
}>(async (c, next) => {
  const identity = c.get('identity');
  if (!identity.canWriteSettings) {
    return c.json({ error: 'Read-only: this action requires dashboard admin.' }, 403);
  }

  return next();
});
