import { container } from '@sapphire/framework';

import { getDb } from '../db/client.js';
import { auditEntries } from '../db/schema.js';
import { isEnabled } from '../features.js';
import type { AuditEntry } from './types.js';

const MAX_DETAIL = 300;

// WHY one write at a time: entries arriving together keep the order they were made in,
// and a burst never takes more than one connection from the pool.
let writing: Promise<void> = Promise.resolve();

function clip(text: string | undefined): string | undefined {
  if (!text) {
    return undefined;
  }

  const flat = text.replaceAll(/\s+/g, ' ').trim();
  return flat.length > MAX_DETAIL ? `${flat.slice(0, MAX_DETAIL - 1)}…` : flat;
}

/** The row for an entry — shared with the move-in of the old day files. */
export function toAuditRow(entry: AuditEntry) {
  return {
    at: entry.at,
    category: entry.category,
    action: entry.action,
    actorId: entry.actor?.id ?? null,
    actorName: entry.actor?.name ?? null,
    target: entry.target ?? null,
    outcome: entry.outcome,
    detail: entry.detail ?? null,
  };
}

/**
 * Records one entry. Never throws and never needs awaiting: a failed write (the
 * database unreachable, say) is logged, and the action being recorded goes on regardless.
 */
export function audit(entry: Omit<AuditEntry, 'at'> & { at?: string }): Promise<void> {
  // Switched off: nothing is kept — except the switching itself, so the log says why it stops.
  if (!isEnabled('audit') && !entry.action.startsWith('features.')) {
    return Promise.resolve();
  }

  const line: AuditEntry = {
    ...entry,
    at: entry.at ?? new Date().toISOString(),
    detail: clip(entry.detail),
  };
  writing = writing.then(async () => {
    try {
      await getDb().insert(auditEntries).values(toAuditRow(line));
    } catch (error) {
      container.logger?.warn('[audit] could not write an entry:', error);
    }
  });
  return writing;
}
