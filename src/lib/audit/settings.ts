import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { dataDir } from '../constants.js';
import { loadSettingsFile } from '../settings-file.js';

/**
 * How much the audit log keeps (`data/audit-settings.json`, a settings file a person can
 * open — docs/decisions/024_v0.8.0_database.md).
 *
 * `musicRequests` — off by default, which is how the log has always been: a music line
 * says only that someone used a feature. An operator who switches it on is choosing to
 * keep what was asked for and the title of what was prepared, from then on; lines
 * already written are not changed either way.
 */

export interface AuditSettings {
  musicRequests: boolean;
}

let filePath = join(dataDir, 'audit-settings.json');
let current: AuditSettings = { musicRequests: false };
let loadError: string | null = null;

function parse(raw: unknown): AuditSettings {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Expected an object');
  }

  return { musicRequests: (raw as { musicRequests?: unknown }).musicRequests === true };
}

export async function loadAuditSettings(): Promise<AuditSettings> {
  const loaded = await loadSettingsFile({
    path: filePath,
    label: 'Audit settings',
    parse,
    empty: () => ({ musicRequests: false }),
  });
  current = loaded.value;
  loadError = loaded.error;
  return current;
}

export function getAuditSettings(): AuditSettings {
  return current;
}

export function getAuditSettingsLoadError(): string | null {
  return loadError;
}

export async function saveAuditSettings(next: AuditSettings): Promise<AuditSettings> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  current = next;
  loadError = null;
  return current;
}

/** Points the settings at another file — for local checks only. */
export function setAuditSettingsPathForChecks(path: string): void {
  filePath = path;
  current = { musicRequests: false };
}
