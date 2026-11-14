import { readdir } from 'node:fs/promises';

import { container } from '@sapphire/framework';

import { migrateFile } from '../db/migrate-file.js';
import { auditEntries } from '../db/schema.js';
import { toAuditRow } from './log.js';
import { AUDIT_FILE, fileForDay, getAuditDir } from './store.js';
import { isAuditCategory, type AuditEntry } from './types.js';

/**
 * Moves the day files the log kept before v0.8.0 into the database, one day at a time.
 *
 * WHY a day per transaction: ninety days of a busy server is a lot of lines; one day
 * is a natural batch, and a restart halfway through resumes at the first day not moved
 * (each day is recorded and set aside as `*.migrated` like any other moved file).
 * Until it is done, the logs page shows what has been moved so far.
 */

const BATCH = 1000;

function decodeLines(text: string): AuditEntry[] {
  const entries: AuditEntry[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    try {
      const entry = JSON.parse(line) as AuditEntry;
      if (
        typeof entry?.at === 'string' &&
        !Number.isNaN(new Date(entry.at).getTime()) &&
        isAuditCategory(entry.category) &&
        typeof entry.action === 'string' &&
        typeof entry.outcome === 'string'
      ) {
        entries.push(entry);
      }
    } catch {
      // A torn line (a crash mid-write) is skipped; the rest of the day still moves.
    }
  }

  return entries;
}

export async function migrateAuditFiles(): Promise<number> {
  let names: string[];
  try {
    names = await readdir(getAuditDir());
  } catch {
    return 0;
  }

  const days = names
    .map((name) => AUDIT_FILE.exec(name)?.[1])
    .filter((day): day is string => day !== undefined)
    .toSorted();
  let moved = 0;
  for (const day of days) {
    const outcome = await migrateFile({
      name: `audit/${day}.jsonl`,
      path: fileForDay(day),
      label: `audit entries of ${day}`,
      decode: (text) => text,
      parse: (raw) => decodeLines(raw as string),
      insert: async (tx, entries) => {
        for (let start = 0; start < entries.length; start += BATCH) {
          await tx.insert(auditEntries).values(entries.slice(start, start + BATCH).map(toAuditRow));
        }
        return entries.length;
      },
    });
    if (outcome === 'migrated') {
      moved += 1;
    }
  }

  if (moved > 0) {
    container.logger.info(`[audit] moved ${moved} day file(s) into the database`);
  }

  return moved;
}
