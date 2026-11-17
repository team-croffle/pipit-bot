import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { users } from '../db/auth-schema.js';
import { getDb } from '../db/client.js';
import type { Transaction } from '../db/migrate-file.js';

/**
 * The dashboard's users, kept in memory (a small team) so mentions, the dashboard and
 * sign-in can find a person without waiting. Every write reaches the database first.
 *
 * Better Auth writes this table itself while signing someone in; its database hooks
 * (lib/auth/hooks.ts) call `reloadUser` so the copy here follows.
 */

export type UserRow = typeof users.$inferSelect;

let rows: UserRow[] = [];

/** The address Better Auth requires. Never shown or mailed: `.invalid` cannot resolve. */
export function placeholderEmail(kind: string, key: string = randomUUID()): string {
  return `${kind}-${key}@users.invalid`.toLowerCase();
}

export async function loadUsers(): Promise<UserRow[]> {
  rows = await getDb().select().from(users);
  return rows;
}

export function getUsers(): UserRow[] {
  return rows;
}

export function findUserById(id: string | undefined | null): UserRow | undefined {
  return id ? rows.find((row) => row.id === id) : undefined;
}

export function findUserByGithubLogin(login: string | undefined | null): UserRow | undefined {
  const wanted = login?.trim().toLowerCase();
  return wanted ? rows.find((row) => row.githubLogin === wanted) : undefined;
}

export function findUserByDiscordId(id: string | undefined | null): UserRow | undefined {
  return id ? rows.find((row) => row.discordUserId === id) : undefined;
}

/** Reads one user again after something other than this module wrote it. */
export async function reloadUser(id: string): Promise<UserRow | undefined> {
  const [row] = await getDb().select().from(users).where(eq(users.id, id));
  rows = rows.filter((existing) => existing.id !== id);
  if (row) {
    rows.push(row);
  }
  return row;
}

export function forgetUser(id: string): void {
  rows = rows.filter((existing) => existing.id !== id);
}

/** Writes `change` to one user and keeps the copy here in step. */
export async function updateUser(
  id: string,
  change: Partial<Pick<UserRow, 'name' | 'groups' | 'githubLogin' | 'discordUserId'>>,
  tx?: Transaction,
): Promise<UserRow | undefined> {
  const [row] = await (tx ?? getDb())
    .update(users)
    .set({ ...change, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  if (row) {
    rows = [...rows.filter((existing) => existing.id !== id), row];
  }
  return row;
}

/** A person who cannot sign in yet — known by their GitHub login (account links). */
export async function createLinkedUser(
  githubLogin: string,
  discordUserId: string | null,
  tx?: Transaction,
): Promise<UserRow> {
  const login = githubLogin.toLowerCase();
  const [row] = await (tx ?? getDb())
    .insert(users)
    .values({
      id: randomUUID(),
      name: login,
      email: placeholderEmail('github', login),
      emailVerified: true,
      githubLogin: login,
      discordUserId,
    })
    .returning();
  rows = [...rows.filter((existing) => existing.id !== row!.id), row!];
  return row!;
}

/** Replaces the copy here — for local checks only. */
export function setUsersForChecks(next: UserRow[]): void {
  rows = next;
}
