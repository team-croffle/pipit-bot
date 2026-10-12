/**
 * One line of the audit log: who did what, and how it went.
 *
 * Music entries say only that someone used a feature — never the track or what was
 * asked for. The team asked for no more than that, and it keeps the music worker's
 * queries out of this repository's records.
 */

export const AUDIT_CATEGORIES = ['dashboard', 'music', 'command', 'github', 'member'] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export type AuditOutcome = 'ok' | 'failed' | 'skipped';

export interface AuditActor {
  /** A Discord user id, when the actor is a Discord user. */
  id?: string;
  name: string;
}

export interface AuditEntry {
  at: string;
  category: AuditCategory;
  /** What was done, e.g. `music.skip`, `/remind`, `settings.update`, `member.join`. */
  action: string;
  actor?: AuditActor;
  /** What it was done to — a repository, a job id, an invite code. */
  target?: string;
  outcome: AuditOutcome;
  detail?: string;
}

export function isAuditCategory(value: string): value is AuditCategory {
  return (AUDIT_CATEGORIES as readonly string[]).includes(value);
}
