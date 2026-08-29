/**
 * A short record of what happened to recent notifications.
 *
 * WHY this exists: every reason a notification does not arrive used to be silent or
 * log-only — an event switched off, no channel configured, a channel the bot cannot
 * post in. From the dashboard the symptom was identical in every case ("I set it up
 * and nothing happens"), and the answer lived in a server log the operator may not
 * have. This puts the answer next to the settings that caused it.
 *
 * In memory and capped: it is a diagnostic aid, not an audit log. Persisted logging
 * is its own roadmap item.
 */

export type DeliveryOutcome = 'sent' | 'failed' | 'skipped';

export interface DeliveryRecord {
  at: string;
  repo: string;
  event: string;
  outcome: DeliveryOutcome;
  /** Why it was skipped, or what Discord said when it failed. */
  detail?: string;
}

const MAX_RECORDS = 20;

const records: DeliveryRecord[] = [];

export function recordDelivery(
  repo: string,
  event: string,
  outcome: DeliveryOutcome,
  detail?: string,
): void {
  records.unshift({ at: new Date().toISOString(), repo, event, outcome, detail });
  if (records.length > MAX_RECORDS) {
    records.length = MAX_RECORDS;
  }
}

/** Newest first. */
export function listDeliveries(): DeliveryRecord[] {
  return [...records];
}
