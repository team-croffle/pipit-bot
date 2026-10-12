import { readdir, unlink } from 'node:fs/promises';

import { container } from '@sapphire/framework';

import { AUDIT_FILE, AUDIT_RETENTION_DAYS, dayKey, fileForDay, getAuditDir } from './store.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Removes day files older than the retention period and says how many went. */
export async function sweepAudit(now = Date.now()): Promise<number> {
  const oldest = dayKey(now - AUDIT_RETENTION_DAYS * DAY_MS);
  let names: string[];
  try {
    names = await readdir(getAuditDir());
  } catch {
    return 0;
  }

  let removed = 0;
  for (const name of names) {
    const day = AUDIT_FILE.exec(name)?.[1];
    if (!day || day >= oldest) {
      continue;
    }

    try {
      await unlink(fileForDay(day));
      removed += 1;
    } catch (error) {
      container.logger?.warn(`[audit] could not remove ${name}:`, error);
    }
  }

  return removed;
}

/** Sweeps now and once a day. */
export function startAuditRetention(): void {
  const run = () => {
    void sweepAudit().then((removed) => {
      if (removed > 0) {
        container.logger.info(
          `[audit] removed ${removed} day file(s) older than ${AUDIT_RETENTION_DAYS} days`,
        );
      }
    });
  };
  run();
  setInterval(run, DAY_MS).unref();
}
