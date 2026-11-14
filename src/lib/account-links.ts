import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { container } from '@sapphire/framework';

import { dataDir } from './constants.js';
import { getDb } from './db/client.js';
import { migrateFile } from './db/migrate-file.js';
import { accountLinks } from './db/schema.js';

/**
 * Which Discord user each GitHub login is.
 *
 * WHY its own store (since v0.8.0): it started as part of the GitHub notification
 * settings, for mentions, but it is identity rather than a setting — personal playlists
 * and the dashboard's own user ask it too, and polls and schedules will. It lives in the
 * database (`account_links`); the `accounts` of an older `data/github-notify.json` are
 * moved in once and taken out of that file, which stays as the notification settings.
 *
 * Kept in memory for mentions and the dashboard, which read it without waiting. A save
 * replaces the links whole, reaches the database first, and a failure reaches the caller.
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

let links: AccountLink[] = [];

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

export async function loadAccountLinks(): Promise<AccountLink[]> {
  await migrateFile({
    name: 'github-notify.json#accounts',
    path: notifySettingsPath,
    label: 'GitHub ↔ Discord account links',
    parse: (raw) => parseAccountLinks((raw as { accounts?: unknown } | null)?.accounts ?? []),
    insert: async (tx, parsed) => {
      if (parsed.length > 0) {
        await tx.insert(accountLinks).values(parsed).onConflictDoNothing();
      }
      return parsed.length;
    },
    // The file stays — it is the notification settings; only the links leave it.
    finish: (moved) => dropAccountsFromNotifySettings(moved !== undefined),
  });

  links = (await getDb().select().from(accountLinks)).toSorted((a, b) =>
    a.githubLogin.localeCompare(b.githubLogin),
  );
  return links;
}

export function getAccountLinks(): AccountLink[] {
  return links;
}

/** Replaces every link; the database first, then memory. */
export async function saveAccountLinks(next: unknown): Promise<AccountLink[]> {
  const parsed = parseAccountLinks(next);
  await getDb().transaction(async (tx) => {
    await tx.delete(accountLinks);
    if (parsed.length > 0) {
      await tx.insert(accountLinks).values(parsed);
    }
  });
  links = parsed.toSorted((a, b) => a.githubLogin.localeCompare(b.githubLogin));
  return links;
}
