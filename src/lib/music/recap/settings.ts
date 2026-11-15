import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { dataDir } from '../../constants.js';
import { loadSettingsFile } from '../../settings-file.js';
import { setRecordingGate } from './recorder.js';

/**
 * The music recap settings (`data/music-recap.json`) — a settings file a person can open,
 * like the other settings under data/.
 *
 * `record` keeps the play history (on by default); `post` sends each month's and year's
 * recap to `channelId` (off until a channel is chosen). Period boundaries follow
 * `timeZone`. `topN` is how many tracks a recap lists.
 */

export interface RecapSettings {
  record: boolean;
  post: boolean;
  channelId: string | null;
  timeZone: string;
  topN: number;
}

export const TOP_N_RANGE = { min: 3, max: 25 } as const;
const DEFAULTS: RecapSettings = {
  record: true,
  post: false,
  channelId: null,
  timeZone: 'Asia/Seoul',
  topN: 10,
};
const SNOWFLAKE = /^\d{17,20}$/;

let filePath = join(dataDir, 'music-recap.json');
let current: RecapSettings = { ...DEFAULTS };
let loadError: string | null = null;

setRecordingGate(() => current.record);

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Checks a whole settings object; returns what is wrong, or the settings. */
export function validateRecapSettings(raw: unknown): RecapSettings | string {
  if (typeof raw !== 'object' || raw === null) {
    return 'Expected an object';
  }

  const value = raw as Partial<Record<keyof RecapSettings, unknown>>;
  if (typeof value.record !== 'boolean' || typeof value.post !== 'boolean') {
    return 'record and post must be true or false';
  }
  if (
    value.channelId !== null &&
    !(typeof value.channelId === 'string' && SNOWFLAKE.test(value.channelId))
  ) {
    return 'channelId must be a channel id or null';
  }
  if (value.post && !value.channelId) {
    return 'Choose a channel before switching posting on';
  }
  if (!isTimeZone(value.timeZone)) {
    return 'timeZone must be an IANA time zone such as Asia/Seoul';
  }
  if (
    typeof value.topN !== 'number' ||
    !Number.isInteger(value.topN) ||
    value.topN < TOP_N_RANGE.min ||
    value.topN > TOP_N_RANGE.max
  ) {
    return `topN must be a whole number from ${TOP_N_RANGE.min} to ${TOP_N_RANGE.max}`;
  }

  return {
    record: value.record,
    post: value.post,
    channelId: value.channelId ?? null,
    timeZone: value.timeZone,
    topN: value.topN,
  };
}

function parse(raw: unknown): RecapSettings {
  // A hand-edited file may leave keys out; what is there must still be right.
  const merged = { ...DEFAULTS, ...(typeof raw === 'object' && raw !== null ? raw : {}) };
  const checked = validateRecapSettings(merged);
  if (typeof checked === 'string') {
    throw new Error(checked);
  }
  return checked;
}

export async function loadRecapSettings(): Promise<RecapSettings> {
  const loaded = await loadSettingsFile({
    path: filePath,
    label: 'Music recap settings',
    parse,
    empty: () => ({ ...DEFAULTS }),
  });
  current = loaded.value;
  loadError = loaded.error;
  return current;
}

export function getRecapSettings(): RecapSettings {
  return { ...current };
}

export function getRecapSettingsLoadError(): string | null {
  return loadError;
}

export async function saveRecapSettings(next: RecapSettings): Promise<RecapSettings> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  current = { ...next };
  loadError = null;
  return getRecapSettings();
}

/** Points the settings at another file — for local checks only. */
export function setRecapSettingsPathForChecks(path: string): void {
  filePath = path;
  current = { ...DEFAULTS };
}
