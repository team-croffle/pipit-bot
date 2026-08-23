import type { IncomingMessage, ServerResponse } from 'node:http';

import type { EnvConfig } from '../../lib/env.js';
import { sendJson } from '../http.js';

export function isDashboardAuthorized(req: IncomingMessage, token: string): boolean {
  const header = req.headers['x-pipit-dashboard-token'];
  if (typeof header !== 'string') {
    return false;
  }

  return header === token;
}

export interface DashboardIdentity {
  user: string | null;
  groups: string[];
  canWriteSettings: boolean;
  canControlPlayback: boolean;
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === 'string' ? value : undefined;
}

function parseGroups(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(/[|,]/)
    .map((group) => group.trim())
    .filter((group) => group.length > 0);
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
    canControlPlayback: isAdmin,
  };
}

export function getDashboardIdentity(req: IncomingMessage, config: EnvConfig): DashboardIdentity {
  const user = headerValue(req, 'x-authentik-username')?.trim() || null;
  const groups = parseGroups(headerValue(req, 'x-authentik-groups'));

  if (user || groups.length > 0) {
    return withCapabilities(user, groups, isAdminGroup(groups, config.dashboardAdminGroups));
  }

  if (config.nodeEnv !== 'production') {
    const isAdmin = config.dashboardDevRole === 'admin';
    return withCapabilities(config.dashboardDevUser, isAdmin ? ['pipit-admins'] : [], isAdmin);
  }

  return withCapabilities(null, [], false);
}

export function sendCapabilityForbidden(res: ServerResponse): void {
  sendJson(res, 403, { error: 'Read-only: this action requires dashboard admin.' });
}
