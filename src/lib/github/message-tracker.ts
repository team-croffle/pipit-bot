/**
 * Which Discord message opened each pull request or issue.
 *
 * WHY this exists: the message that announces a pull request lists its assignees and
 * reviewers as they were at that moment. People are added afterwards, and until now
 * the announcement stayed stale while a second message carried the news. Knowing
 * which message it was lets a later assignment edit it in place.
 *
 * WHY the database: a pull request lives for days and the bot restarts in between.
 * It was a capped JSON file until v0.8.0 and was the first thing moved into the
 * database; the file is moved in once (`*.migrated`). The entries are kept in memory
 * too, so dispatch reads them without waiting, and every change is written through.
 * Writes go out one after another — two changes to the same pull request landing
 * together must not reach the database in the wrong order. A failed write is logged
 * and costs one future edit, never a notification. The cap stays: only recent pull
 * requests are worth editing.
 *
 * Only the opening message is tracked. Later messages about the same pull request
 * (an approval, a merge) are news of their own moment and are left as sent.
 */

import { join } from 'node:path';

import { container } from '@sapphire/framework';
import { eq, inArray } from 'drizzle-orm';

import { dataDir } from '../constants.js';
import { getDb } from '../db/client.js';
import { migrateFile } from '../db/migrate-file.js';
import { trackedMessages } from '../db/schema.js';
import type { GithubEventToggles } from './settings.js';

export interface TrackedMessage {
  channelId: string;
  messageId: string;
  /** The event whose wording produced the message — what a later edit re-renders. */
  toggle: keyof GithubEventToggles;
  /** ISO time of the send; the oldest go first when the cap is hit. */
  at: string;
  /**
   * Lower-cased logins the announcement pinged. The reviewers and assignees set on
   * the creation form arrive as their own events right after `opened`, and this is
   * how dispatch knows they have been told already.
   */
  mentioned: string[];
}

const legacyPath = join(dataDir, 'github-messages.json');
const snowflake = /^\d{17,20}$/;
const MAX_ENTRIES = 500;

let entries = new Map<string, TrackedMessage>();
let writes: Promise<void> = Promise.resolve();

function keyFor(repo: string, number: number): string {
  return `${repo.toLowerCase()}#${number}`;
}

function parseEntry(value: unknown): TrackedMessage | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const row = value as Record<string, unknown>;
  if (
    typeof row.channelId !== 'string' ||
    !snowflake.test(row.channelId) ||
    typeof row.messageId !== 'string' ||
    !snowflake.test(row.messageId) ||
    typeof row.toggle !== 'string' ||
    typeof row.at !== 'string'
  ) {
    return undefined;
  }

  return {
    channelId: row.channelId,
    messageId: row.messageId,
    toggle: row.toggle as keyof GithubEventToggles,
    at: row.at,
    // Entries from rc.7 have no list; they simply never suppress an echo.
    mentioned: Array.isArray(row.mentioned)
      ? row.mentioned.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

/** Drops the oldest entries past the cap; returns their keys. */
function prune(): string[] {
  if (entries.size <= MAX_ENTRIES) {
    return [];
  }

  const sorted = [...entries.entries()].toSorted(([, a], [, b]) => a.at.localeCompare(b.at));
  const dropped = sorted.slice(0, entries.size - MAX_ENTRIES).map(([key]) => key);
  for (const key of dropped) {
    entries.delete(key);
  }

  return dropped;
}

function write(change: () => Promise<unknown>): void {
  writes = writes.then(change).then(
    () => undefined,
    (error: unknown) => {
      container.logger.warn('[github] could not save the message tracker:', error);
    },
  );
}

/** The file used before v0.8.0: `{ version: 1, entries: { key: entry } }`. */
function parseLegacyFile(raw: unknown): Map<string, TrackedMessage> {
  const stored = (raw as { entries?: unknown } | null)?.entries;
  const parsed = new Map<string, TrackedMessage>();
  if (stored && typeof stored === 'object') {
    for (const [key, value] of Object.entries(stored)) {
      const entry = parseEntry(value);
      if (entry) {
        parsed.set(key, entry);
      }
    }
  }

  return parsed;
}

export async function loadTrackedMessages(): Promise<void> {
  await migrateFile({
    name: 'github-messages.json',
    path: legacyPath,
    label: 'tracked GitHub messages',
    parse: parseLegacyFile,
    insert: async (tx, parsed) => {
      const rows = [...parsed].map(([key, entry]) => ({ key, ...entry }));
      if (rows.length > 0) {
        await tx.insert(trackedMessages).values(rows).onConflictDoNothing();
      }
      return rows.length;
    },
  });

  const next = new Map<string, TrackedMessage>();
  for (const row of await getDb().select().from(trackedMessages)) {
    // The database writes times its own way; the cap sorts on ISO strings.
    const entry = parseEntry({ ...row, at: new Date(row.at).toISOString() });
    if (entry) {
      next.set(row.key, entry);
    }
  }
  entries = next;
}

/** Resolves once every change made so far has reached the database — for local checks. */
export function trackedMessageWritesSettled(): Promise<void> {
  return writes;
}

export function findTrackedMessage(repo: string, number: number): TrackedMessage | undefined {
  return entries.get(keyFor(repo, number));
}

export function rememberMessage(
  repo: string,
  number: number,
  message: Omit<TrackedMessage, 'at'>,
): void {
  const key = keyFor(repo, number);
  const entry = { ...message, at: new Date().toISOString() };
  entries.set(key, entry);
  const dropped = prune();
  write(async () => {
    const row = { key, ...entry };
    await getDb()
      .insert(trackedMessages)
      .values(row)
      .onConflictDoUpdate({ target: trackedMessages.key, set: row });
    if (dropped.length > 0) {
      await getDb().delete(trackedMessages).where(inArray(trackedMessages.key, dropped));
    }
  });
}

/** For a message that is gone — deleted by hand, or in a channel that no longer exists. */
export function forgetMessage(repo: string, number: number): void {
  const key = keyFor(repo, number);
  if (entries.delete(key)) {
    write(() => getDb().delete(trackedMessages).where(eq(trackedMessages.key, key)));
  }
}
