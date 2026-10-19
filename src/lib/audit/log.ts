import { appendFile, mkdir } from 'node:fs/promises';

import { container } from '@sapphire/framework';

import { isEnabled } from '../features.js';
import { dayKey, fileForDay, getAuditDir } from './store.js';
import type { AuditEntry } from './types.js';

const MAX_DETAIL = 300;

// WHY: entries are appended one at a time so two that arrive together never
// interleave inside a line.
let writing: Promise<void> = Promise.resolve();

function clip(text: string | undefined): string | undefined {
  if (!text) {
    return undefined;
  }

  const flat = text.replaceAll(/\s+/g, ' ').trim();
  return flat.length > MAX_DETAIL ? `${flat.slice(0, MAX_DETAIL - 1)}…` : flat;
}

/**
 * Records one entry. Never throws and never needs awaiting: a failed write is
 * logged, and the action being recorded goes on regardless.
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
      await mkdir(getAuditDir(), { recursive: true });
      await appendFile(fileForDay(dayKey(line.at)), `${JSON.stringify(line)}\n`, 'utf8');
    } catch (error) {
      container.logger?.warn('[audit] could not write an entry:', error);
    }
  });
  return writing;
}
