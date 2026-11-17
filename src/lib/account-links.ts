import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { container } from '@sapphire/framework';

import { dataDir } from './constants.js';
import { getDb } from './db/client.js';
import { migrateFile, type Transaction } from './db/migrate-file.js';
import {
  createLinkedUser,
  findUserByDiscordId,
  findUserByGithubLogin,
  getUsers,
  loadUsers,
  updateUser,
} from './users/store.js';

/**
 * Which Discord user each GitHub login is.
 *
 * WHY on top of users (since v0.8.2): the links started in the GitHub notification
 * settings, moved to their own table in v0.8.0, and are now two columns of the dashboard's
 * users (users/store.ts) — a person who signs in is the same person a mention pings. The
 * `account_links` table was moved into `users` by migration 0010 and dropped by 0011.
 * This module keeps the old shape for the GitHub page and the mention code.
 *
 * The `accounts` of an older `data/github-notify.json` are still moved in once (a server
 * coming from before v0.8.0) and taken out of that file, which stays as the settings.
 */

export interface AccountLink {
  /** Lower-cased. */
  githubLogin: string;
  discordUserId: string;
}

const MAX_LINKS = 200;
const snowflake = /^\d{17,20}$/;
// WHY: The real GitHub username grammar. Also a security control — it makes a login
// like `everyone`, or one carrying backticks/`<`/`@`, impossible to persist.
const githubLogin = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const notifySettingsPath = join(dataDir, 'github-notify.json');

export function parseAccountLinks(value: unknown): AccountLink[] {
  if (!Array.isArray(value)) {
    throw new Error('accounts must be an array');
  }

  const parsed: AccountLink[] = [];
  const seen = new Set<string>();
  for (const item of value.slice(0, MAX_LINKS)) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid account mapping');
    }

    const row = item as Record<string, unknown>;
    const login = typeof row.githubLogin === 'string' ? row.githubLogin.trim().toLowerCase() : '';
    if (!githubLogin.test(login)) {
      throw new Error('Each account needs a valid GitHub login');
    }

    if (seen.has(login)) {
      throw new Error(`Duplicate GitHub login: ${login}`);
    }

    if (typeof row.discordUserId !== 'string' || !snowflake.test(row.discordUserId)) {
      throw new Error('Each account needs a Discord user id');
    }

    seen.add(login);
    parsed.push({ githubLogin: login, discordUserId: row.discordUserId });
  }

  return parsed;
}

/**
 * Takes `accounts` out of the notification settings file, leaving the rest as it is.
 * `afterMove` is false on a later start: links found then were put back by an older
 * image and are not moved in — the database is the record — so that is said out loud.
 */
async function dropAccountsFromNotifySettings(afterMove: boolean): Promise<void> {
  const raw = JSON.parse(await readFile(notifySettingsPath, 'utf8')) as Record<string, unknown>;
  if (!('accounts' in raw)) {
    return;
  }

  const hadLinks = Array.isArray(raw.accounts) && raw.accounts.length > 0;
  delete raw.accounts;
  await writeFile(notifySettingsPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  if (hadLinks && afterMove) {
    container.logger.info('[db] took the account links out of github-notify.json');
  } else if (hadLinks) {
    container.logger.warn(
      '[db] github-notify.json had account links again; they were not moved in (edit them on the GitHub page) and were taken out of the file',
    );
  }
}

/** Writes one link into `users`: the user with that login gets the Discord id, or is created. */
async function writeLink(tx: Transaction, link: AccountLink): Promise<void> {
  const holder = findUserByDiscordId(link.discordUserId);
  if (holder && holder.githubLogin !== link.githubLogin) {
    await updateUser(holder.id, { discordUserId: null }, tx);
  }

  const user = findUserByGithubLogin(link.githubLogin);
  if (user) {
    await updateUser(user.id, { discordUserId: link.discordUserId }, tx);
  } else {
    await createLinkedUser(link.githubLogin, link.discordUserId, tx);
  }
}

/** Moves the links of an older github-notify.json in; call after `loadUsers`. */
export async function loadAccountLinks(): Promise<AccountLink[]> {
  await migrateFile({
    name: 'github-notify.json#accounts',
    path: notifySettingsPath,
    label: 'GitHub ↔ Discord account links',
    parse: (raw) => parseAccountLinks((raw as { accounts?: unknown } | null)?.accounts ?? []),
    insert: async (tx, parsed) => {
      for (const link of parsed) {
        if (!findUserByGithubLogin(link.githubLogin)) {
          await writeLink(tx, link);
        }
      }
      return parsed.length;
    },
    // The file stays — it is the notification settings; only the links leave it.
    finish: (moved) => dropAccountsFromNotifySettings(moved !== undefined),
  });

  return getAccountLinks();
}

/** Users with both a GitHub login and a Discord id, by login. */
export function getAccountLinks(): AccountLink[] {
  return getUsers()
    .filter((user) => user.githubLogin && user.discordUserId)
    .map((user) => ({ githubLogin: user.githubLogin!, discordUserId: user.discordUserId! }))
    .toSorted((a, b) => a.githubLogin.localeCompare(b.githubLogin));
}

/**
 * Replaces every link. A login left out keeps its user (who may sign in) and loses only
 * the Discord id; a new login becomes a user.
 */
export async function saveAccountLinks(next: unknown): Promise<AccountLink[]> {
  const parsed = parseAccountLinks(next);
  const kept = new Set(parsed.map((link) => link.githubLogin));
  try {
    await getDb().transaction(async (tx) => {
      for (const user of getUsers()) {
        if (user.githubLogin && user.discordUserId && !kept.has(user.githubLogin)) {
          await updateUser(user.id, { discordUserId: null }, tx);
        }
      }
      for (const link of parsed) {
        await writeLink(tx, link);
      }
    });
  } catch (error) {
    // The copy in memory followed writes the rollback undid.
    await loadUsers();
    throw error;
  }
  return getAccountLinks();
}
