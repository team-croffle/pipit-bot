/**
 * Which Discord message opened each pull request or issue.
 *
 * WHY this exists: the message that announces a pull request lists its assignees and
 * reviewers as they were at that moment. People are added afterwards, and until now
 * the announcement stayed stale while a second message carried the news. Knowing
 * which message it was lets a later assignment edit it in place.
 *
 * WHY a file and not memory: a pull request lives for days and the bot restarts in
 * between. WHY a file and not a database: there is no database yet — v0.8.0 brings
 * one, and this store is the first thing scheduled to move into it. Until then the
 * file is capped and drops its oldest entries, so it cannot grow with history.
 *
 * Only the opening message is tracked. Later messages about the same pull request
 * (an approval, a merge) are news of their own moment and are left as sent.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { container } from '@sapphire/framework';

import { dataDir } from '../constants.js';
import type { GithubEventToggles } from './settings.js';

export interface TrackedMessage {
  channelId: string;
  messageId: string;
  /** The event whose wording produced the message — what a later edit re-renders. */
  toggle: keyof GithubEventToggles;
  /** ISO time of the send; the oldest go first when the cap is hit. */
  at: string;
}

interface StoredFile {
  version: 1;
  entries: Record<string, TrackedMessage>;
}

const storePath = join(dataDir, 'github-messages.json');
const snowflake = /^\d{17,20}$/;
const MAX_ENTRIES = 500;

let entries = new Map<string, TrackedMessage>();
// One write at a time, and only the latest state: deliveries landing together mark
// the store dirty, and whichever write is running picks the newest snapshot up next.
let dirty = false;
let writing = false;

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
  };
}

function prune(): void {
  if (entries.size <= MAX_ENTRIES) {
    return;
  }

  const sorted = [...entries.entries()].toSorted(([, a], [, b]) => a.at.localeCompare(b.at));
  for (const [key] of sorted.slice(0, entries.size - MAX_ENTRIES)) {
    entries.delete(key);
  }
}

async function flush(): Promise<void> {
  writing = true;
  try {
    while (dirty) {
      dirty = false;
      const snapshot: StoredFile = { version: 1, entries: Object.fromEntries(entries) };
      await mkdir(dataDir, { recursive: true });
      await writeFile(storePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    }
  } catch (error) {
    // A failed write costs one future edit, not a notification — so log and go on.
    container.logger.warn('[github] could not save the message tracker:', error);
  } finally {
    writing = false;
  }
}

function persist(): void {
  dirty = true;
  if (!writing) {
    void flush();
  }
}

export async function loadTrackedMessages(): Promise<void> {
  try {
    const raw = JSON.parse(await readFile(storePath, 'utf8')) as unknown;
    const stored = (raw as Partial<StoredFile> | null)?.entries;
    const next = new Map<string, TrackedMessage>();
    if (stored && typeof stored === 'object') {
      for (const [key, value] of Object.entries(stored)) {
        const entry = parseEntry(value);
        if (entry) {
          next.set(key, entry);
        }
      }
    }
    entries = next;
  } catch {
    entries = new Map();
  }
}

export function findTrackedMessage(repo: string, number: number): TrackedMessage | undefined {
  return entries.get(keyFor(repo, number));
}

export function rememberMessage(
  repo: string,
  number: number,
  message: Omit<TrackedMessage, 'at'>,
): void {
  entries.set(keyFor(repo, number), { ...message, at: new Date().toISOString() });
  prune();
  persist();
}

/** For a message that is gone — deleted by hand, or in a channel that no longer exists. */
export function forgetMessage(repo: string, number: number): void {
  if (entries.delete(keyFor(repo, number))) {
    persist();
  }
}
