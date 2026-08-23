import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface RuntimeConfig {
  prefix: string;
  musicChannelIds: string[];
}

interface RuntimeConfigPatch {
  prefix?: string;
  musicChannelIds?: string[];
}

interface StoredRuntimeConfig extends Partial<RuntimeConfig> {
  commandChannelId?: string;
}

let filePath: string | undefined;
let cached: RuntimeConfig;

function normalizeMusicChannelIds(stored: StoredRuntimeConfig, fallback: string[]): string[] {
  if (Array.isArray(stored.musicChannelIds)) {
    return stored.musicChannelIds.filter((id) => typeof id === 'string' && id.trim());
  }

  if (typeof stored.commandChannelId === 'string' && stored.commandChannelId.trim()) {
    return [stored.commandChannelId.trim()];
  }

  return fallback;
}

function readFromDisk(): StoredRuntimeConfig {
  if (!filePath || !existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as StoredRuntimeConfig;
  } catch {
    return {};
  }
}

function writeToDisk(data: RuntimeConfig): void {
  if (!filePath) {
    return;
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export function initRuntimeConfig(path: string, defaults: RuntimeConfig): RuntimeConfig {
  filePath = path;
  const stored = readFromDisk();

  cached = {
    prefix: stored.prefix ?? defaults.prefix,
    musicChannelIds: normalizeMusicChannelIds(stored, defaults.musicChannelIds),
  };

  const migratedFromLegacy =
    !Array.isArray(stored.musicChannelIds) &&
    typeof stored.commandChannelId === 'string' &&
    stored.commandChannelId.trim().length > 0;

  if (!existsSync(filePath) || migratedFromLegacy) {
    writeToDisk(cached);
  }

  return cached;
}

export function getRuntimeConfig(): RuntimeConfig {
  return cached;
}

export function updateRuntimeConfig(patch: RuntimeConfigPatch): RuntimeConfig {
  cached = {
    prefix: patch.prefix?.trim() || cached.prefix,
    musicChannelIds:
      patch.musicChannelIds !== undefined
        ? patch.musicChannelIds.filter((id) => id.trim())
        : cached.musicChannelIds,
  };

  writeToDisk(cached);
  return cached;
}
