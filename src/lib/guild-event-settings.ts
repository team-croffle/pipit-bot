import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { dataDir } from './constants.js';

// WHY: Prefix, command channel, and RSS belong to bot config (C), not this store.
export interface GuildEventSettings {
  logChannelId: string | null;
  joinMessages: string[];
  leaveMessages: string[];
  joinRoleIds: string[];
}

const eventsPath = join(dataDir, 'guild-events.json');
const legacyPath = join(dataDir, 'guild-settings.json');
const snowflake = /^\d{17,20}$/;

function emptySettings(): GuildEventSettings {
  return {
    logChannelId: null,
    joinMessages: [],
    leaveMessages: [],
    joinRoleIds: [],
  };
}

let cache: GuildEventSettings | undefined;

function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && snowflake.test(value);
}

function asStringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected a string array');
  }

  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, maxItems);

  if (items.some((item) => item.length > maxLength)) {
    throw new Error(`Each string must be at most ${maxLength} characters`);
  }

  return items;
}

export function parseGuildEventSettings(raw: unknown): GuildEventSettings {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Settings must be an object');
  }

  const body = raw as Record<string, unknown>;
  const logChannelId = body.logChannelId;
  if (
    logChannelId !== null &&
    logChannelId !== undefined &&
    logChannelId !== '' &&
    !isSnowflake(logChannelId)
  ) {
    throw new Error('logChannelId must be a snowflake or null');
  }

  const joinRoleIds = asStringList(body.joinRoleIds ?? [], 20, 20);
  if (!joinRoleIds.every(isSnowflake)) {
    throw new Error('joinRoleIds must be role snowflakes');
  }

  return {
    logChannelId:
      logChannelId === null || logChannelId === undefined || logChannelId === ''
        ? null
        : logChannelId,
    joinMessages: asStringList(body.joinMessages ?? [], 20, 2000),
    leaveMessages: asStringList(body.leaveMessages ?? [], 20, 2000),
    joinRoleIds,
  };
}

export function getGuildEventSettings(): GuildEventSettings {
  return cache ?? emptySettings();
}

async function readSettingsFile(): Promise<string> {
  try {
    return await readFile(eventsPath, 'utf8');
  } catch {
    return readFile(legacyPath, 'utf8');
  }
}

export async function loadGuildEventSettings(): Promise<GuildEventSettings> {
  try {
    cache = parseGuildEventSettings(JSON.parse(await readSettingsFile()) as unknown);
  } catch {
    cache = emptySettings();
  }

  return getGuildEventSettings();
}

export async function saveGuildEventSettings(
  next: GuildEventSettings,
): Promise<GuildEventSettings> {
  const parsed = parseGuildEventSettings(next);
  await mkdir(dataDir, { recursive: true });
  await writeFile(eventsPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  cache = parsed;
  return parsed;
}

export function pickRandomMessage(messages: string[]): string | undefined {
  if (messages.length === 0) {
    return undefined;
  }

  const index = Math.floor(Math.random() * messages.length);
  return messages[index];
}

export function formatTemplate(template: string, values: Record<string, string>): string {
  return template.replaceAll(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}
