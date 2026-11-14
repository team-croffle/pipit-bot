import { join } from 'node:path';

import { dataDir } from '../constants.js';

/** Days an audit entry is kept. */
export const AUDIT_RETENTION_DAYS = 90;

// Until v0.8.0 the log was one JSON-lines file per day here; they are moved into the
// database at start-up (migrate.ts). Nothing writes here any more.

export const AUDIT_FILE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;

let auditDir = join(dataDir, 'audit');

export function getAuditDir(): string {
  return auditDir;
}

/** Points the move-in at another directory — for local checks only. */
export function setAuditDirForChecks(dir: string): void {
  auditDir = dir;
}

/** `YYYY-MM-DD` in UTC — one file per day. */
export function dayKey(time: Date | number | string): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function fileForDay(day: string): string {
  return join(auditDir, `${day}.jsonl`);
}
