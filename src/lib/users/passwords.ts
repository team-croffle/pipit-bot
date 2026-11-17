import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { getAuth } from '../auth/instance.js';
import { passwordProblem } from '../auth/password-policy.js';
import { accounts, users } from '../db/auth-schema.js';
import { getDb } from '../db/client.js';
import type { EnvConfig } from '../env.js';
import { getUsers, placeholderEmail, reloadUser, type UserRow } from './store.js';

/**
 * Password accounts, made and changed by the bot itself — the first admin, the development
 * accounts, the users page. WHY not through Better Auth's endpoints: sign-up is closed and
 * its admin endpoints are not exposed (2026-11-18, the team). The rows are written here
 * (the tables are the bot's own); the hash is Better Auth's, so its sign-in verifies it.
 */

const USERNAME = /^[a-z0-9_.]{3,30}$/;

export class UserInputError extends Error {}

export function normalizeUsername(raw: unknown): string {
  const username = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!USERNAME.test(username)) {
    throw new UserInputError(
      'A user name has 3 to 30 characters: letters, digits, "_" and "." only.',
    );
  }
  return username;
}

function checkPassword(password: unknown): string {
  const problem = passwordProblem(password);
  if (problem) {
    throw new UserInputError(problem);
  }
  return password as string;
}

export async function hasPasswordAccounts(): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.providerId, 'credential'))
    .limit(1);
  return Boolean(row);
}

export async function createPasswordUser(
  config: EnvConfig,
  input: { username: unknown; password: unknown; groups?: string[]; devSeed?: boolean },
): Promise<UserRow> {
  const username = normalizeUsername(input.username);
  const password = checkPassword(input.password);
  const context = await (await getAuth(config)).$context;
  if (getUsers().some((user) => user.username === username)) {
    throw new UserInputError(`The user name ${username} is taken.`);
  }

  const hash = await context.password.hash(password);
  const id = randomUUID();
  await getDb().transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      name: username,
      email: placeholderEmail('user', id),
      emailVerified: true,
      username,
      displayUsername: username,
      groups: input.groups ?? [],
      devSeed: input.devSeed ?? false,
    });
    await tx.insert(accounts).values({
      id: randomUUID(),
      providerId: 'credential',
      accountId: id,
      userId: id,
      password: hash,
    });
  });
  return (await reloadUser(id))!;
}

/** Sets (or adds) a user's password and ends every session they have. */
export async function setUserPassword(
  config: EnvConfig,
  userId: string,
  password: unknown,
): Promise<void> {
  const checked = checkPassword(password);
  const context = await (await getAuth(config)).$context;
  const hash = await context.password.hash(checked);
  const [credential] = await getDb()
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')));
  if (credential) {
    await context.internalAdapter.updatePassword(userId, hash);
  } else {
    await getDb().insert(accounts).values({
      id: randomUUID(),
      providerId: 'credential',
      accountId: userId,
      userId,
      password: hash,
    });
  }
  await context.internalAdapter.deleteUserSessions(userId);
}
