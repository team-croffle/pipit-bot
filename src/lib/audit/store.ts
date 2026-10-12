import { join } from 'node:path';

import { dataDir } from '../constants.js';

/** Days an audit file is kept. */
export const AUDIT_RETENTION_DAYS = 90;

export const AUDIT_FILE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;

let auditDir = join(dataDir, 'audit');

export function getAuditDir(): string {
  return auditDir;
}

/** Points the log at another directory — for local checks only. */
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
