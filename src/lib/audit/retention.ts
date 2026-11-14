import { container } from '@sapphire/framework';
import { lt } from 'drizzle-orm';

import { getDb } from '../db/client.js';
import { auditEntries } from '../db/schema.js';
import { migrateAuditFiles } from './migrate.js';
import { AUDIT_RETENTION_DAYS } from './store.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Removes entries older than the retention period and says how many went. */
export async function sweepAudit(now = Date.now()): Promise<number> {
  const oldest = new Date(now - AUDIT_RETENTION_DAYS * DAY_MS).toISOString();
  const removed = await getDb()
    .delete(auditEntries)
    .where(lt(auditEntries.at, oldest))
    .returning({ id: auditEntries.id });
  return removed.length;
}

/**
 * Moves the old day files in (in the background — a long log must not hold up the
 * start), then sweeps now and once a day.
 */
export function startAuditRetention(): void {
  const run = () => {
    void sweepAudit()
      .then((removed) => {
        if (removed > 0) {
          container.logger.info(
            `[audit] removed ${removed} entries older than ${AUDIT_RETENTION_DAYS} days`,
          );
        }
      })
      .catch((error: unknown) => container.logger.warn('[audit] could not sweep:', error));
  };

  void migrateAuditFiles()
    .catch((error: unknown) =>
      container.logger.warn('[audit] could not move the day files in:', error),
    )
    .finally(run);
  setInterval(run, DAY_MS).unref();
}
