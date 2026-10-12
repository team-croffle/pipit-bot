/**
 * A short record of what happened to recent notifications.
 *
 * WHY this exists: every reason a notification does not arrive used to be silent or
 * log-only — an event switched off, no channel configured, a channel the bot cannot
 * post in. From the dashboard the symptom was identical in every case ("I set it up
 * and nothing happens"), and the answer lived in a server log the operator may not
 * have. This puts the answer next to the settings that caused it.
 *
 * In memory and capped: it is a diagnostic aid for the GitHub page. Every record is
 * also written to the audit log, which keeps them for longer.
 */

import { audit } from '../audit/log.js';

/** `edited` — nothing new was posted, but the message that opened the item was updated. */
export type DeliveryOutcome = 'sent' | 'edited' | 'failed' | 'skipped';

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
): DeliveryRecord {
  const record: DeliveryRecord = { at: new Date().toISOString(), repo, event, outcome, detail };
  records.unshift(record);
  void audit({
    category: 'github',
    action: event,
    target: repo,
    outcome: outcome === 'sent' || outcome === 'edited' ? 'ok' : outcome,
    detail: outcome === 'edited' ? ['edited', detail].filter(Boolean).join(' · ') : detail,
  });
  if (records.length > MAX_RECORDS) {
    records.length = MAX_RECORDS;
  }

  return record;
}

/** Newest first. */
export function listDeliveries(): DeliveryRecord[] {
  return [...records];
}
