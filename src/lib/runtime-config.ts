import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface RuntimeConfig {
  prefix: string;
  commandChannelId: string | undefined;
}

interface RuntimeConfigPatch {
  prefix?: string;
  commandChannelId?: string | null; // null = 해제(clear)
}

let filePath: string | undefined;
let cached: RuntimeConfig;

function readFromDisk(): Partial<RuntimeConfig> {
  if (!filePath || !existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as Partial<RuntimeConfig>;
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
    commandChannelId: stored.commandChannelId ?? defaults.commandChannelId,
  };

  if (!existsSync(filePath)) {
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
    commandChannelId:
      patch.commandChannelId === null
        ? undefined
        : (patch.commandChannelId ?? cached.commandChannelId),
  };

  writeToDisk(cached);
  return cached;
}
