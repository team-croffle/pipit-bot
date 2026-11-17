import { eq } from 'drizzle-orm';

import { getAuth } from '../auth/instance.js';
import { accounts, users } from '../db/auth-schema.js';
import { getDb } from '../db/client.js';
import type { EnvConfig } from '../env.js';
import { UserInputError } from './passwords.js';
import { findUserById, forgetUser, getUsers, updateUser, type UserRow } from './store.js';

/**
 * What the users page changes (routes/users.ts): admin, the GitHub login and Discord id
 * a person is known by, and removing a user.
 *
 * WHY these rules (2026-11-18, the team): admin is a group, so making someone admin
 * gives the first `DASHBOARD_ADMIN_GROUPS` group on the dashboard; a group the identity
 * provider gives can only be taken away there. An admin is never deleted — take admin
 * away first — and nobody takes their own admin away, so the dashboard cannot lock out the
 * person using it. The handles are entered by an admin, not by the person: whoever claims
 * a Discord id sees that person's recap and personal playlists.
 */

const SNOWFLAKE = /^\d{17,20}$/;
const GITHUB_LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export interface UserView {
  id: string;
  name: string;
  username: string | null;
  githubLogin: string | null;
  discordUserId: string | null;
  /** Given on the dashboard. */
  groups: string[];
  /** From the identity provider at the last OIDC sign-in. */
  idpGroups: string[];
  admin: boolean;
  /** Admin through an identity provider group, which the dashboard cannot take away. */
  adminByProvider: boolean;
  /** How the person signs in: `password`, `oidc`, `discord`, `github`; empty when they cannot. */
  methods: string[];
  createdAt: string;
}

function isAdminGroupName(group: string, config: EnvConfig): boolean {
  return config.dashboardAdminGroups.some((admin) => admin.toLowerCase() === group.toLowerCase());
}

function adminGroup(config: EnvConfig): string {
  return config.dashboardAdminGroups[0] ?? 'pipit-admins';
}

export function isUserAdmin(user: UserRow, config: EnvConfig): boolean {
  return [...user.groups, ...user.idpGroups].some((group) => isAdminGroupName(group, config));
}

export async function listUserViews(config: EnvConfig): Promise<UserView[]> {
  const rows = await getDb()
    .select({ userId: accounts.userId, providerId: accounts.providerId })
    .from(accounts);
  const methodsOf = (id: string) =>
    rows
      .filter((row) => row.userId === id)
      .map((row) => (row.providerId === 'credential' ? 'password' : row.providerId))
      .toSorted();

  return getUsers()
    .map((user) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      githubLogin: user.githubLogin,
      discordUserId: user.discordUserId,
      groups: user.groups,
      idpGroups: user.idpGroups,
      admin: isUserAdmin(user, config),
      adminByProvider: user.idpGroups.some((group) => isAdminGroupName(group, config)),
      methods: methodsOf(user.id),
      createdAt: user.createdAt.toISOString(),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

function requireUser(id: string): UserRow {
  const user = findUserById(id);
  if (!user) {
    throw new UserInputError('No such user.');
  }
  return user;
}

function handle(value: unknown, pattern: RegExp, what: string): string | null {
  if (value === null || value === '') {
    return null;
  }
  const text = typeof value === 'string' ? value.trim() : '';
  if (!pattern.test(text)) {
    throw new UserInputError(`That is not a valid ${what}.`);
  }
  return text;
}

export interface UserChange {
  admin?: unknown;
  githubLogin?: unknown;
  discordUserId?: unknown;
}

export async function changeUser(
  config: EnvConfig,
  actorId: string | undefined,
  id: string,
  change: UserChange,
): Promise<UserRow> {
  const user = requireUser(id);
  const next: Parameters<typeof updateUser>[1] = {};

  if (change.admin !== undefined) {
    if (typeof change.admin !== 'boolean') {
      throw new UserInputError('admin must be true or false.');
    }
    const kept = user.groups.filter((group) => !isAdminGroupName(group, config));
    if (change.admin) {
      next.groups = [...kept, adminGroup(config)];
    } else {
      if (id === actorId) {
        throw new UserInputError('You cannot take away your own admin.');
      }
      if (user.idpGroups.some((group) => isAdminGroupName(group, config))) {
        throw new UserInputError('Admin comes from the identity provider; change it there.');
      }
      next.groups = kept;
    }
  }

  if (change.githubLogin !== undefined) {
    const login = handle(change.githubLogin, GITHUB_LOGIN, 'GitHub login')?.toLowerCase() ?? null;
    if (login && getUsers().some((other) => other.id !== id && other.githubLogin === login)) {
      throw new UserInputError(`The GitHub login ${login} belongs to another user.`);
    }
    next.githubLogin = login;
  }

  if (change.discordUserId !== undefined) {
    const discord = handle(change.discordUserId, SNOWFLAKE, 'Discord user id');
    if (discord && getUsers().some((other) => other.id !== id && other.discordUserId === discord)) {
      throw new UserInputError('That Discord user id belongs to another user.');
    }
    next.discordUserId = discord;
  }

  return (await updateUser(id, next)) ?? user;
}

export async function removeUser(
  config: EnvConfig,
  actorId: string | undefined,
  id: string,
): Promise<UserRow> {
  const user = requireUser(id);
  if (id === actorId) {
    throw new UserInputError('You cannot delete yourself.');
  }
  if (isUserAdmin(user, config)) {
    throw new UserInputError('An admin cannot be deleted. Take admin away first.');
  }

  const context = await (await getAuth(config)).$context;
  await context.internalAdapter.deleteUserSessions(id);
  // Sessions and sign-in accounts go with the user (on delete cascade).
  await getDb().delete(users).where(eq(users.id, id));
  forgetUser(id);
  return user;
}
