import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { container } from '@sapphire/framework';

import { dataDir } from '../constants.js';
import { loadSettingsFile } from '../settings-file.js';
import { isLanguage, type Language } from './index.js';

/**
 * Which language the bot speaks (`data/language.json`, a settings file a person can open).
 *
 * WHY a server default plus one override per feature (2026-11-21, the team): most servers
 * want one language everywhere, but a channel shared with people outside the team — the
 * GitHub feed, say — may want another. A feature set to `null` follows `messages`.
 *
 * `dashboard` is the dashboard's server default; a person's own choice (users.locale)
 * comes first, and with neither the browser's language decides — so a fresh install looks
 * the way it did before.
 *
 * Replies only one person sees never come from here: they follow that person's Discord
 * language.
 */

export const MESSAGE_FEATURES = [
  'github',
  'memberEvents',
  'reactionRoles',
  'music',
  'recap',
] as const;
export type MessageFeature = (typeof MESSAGE_FEATURES)[number];

export interface LanguageSettings {
  dashboard: Language | null;
  messages: Language;
  features: Record<MessageFeature, Language | null>;
}

function defaults(): LanguageSettings {
  return {
    dashboard: null,
    messages: 'en',
    features: { github: null, memberEvents: null, reactionRoles: null, music: null, recap: null },
  };
}

let filePath = join(dataDir, 'language.json');
let recapPath = join(dataDir, 'music-recap.json');
let current: LanguageSettings = defaults();
let loadError: string | null = null;

const optional = (value: unknown, what: string): Language | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isLanguage(value)) {
    throw new Error(`${what} must be en, ko or null`);
  }
  return value;
};

/** Checks a whole settings object; throws what is wrong. Keys left out keep their default. */
export function parseLanguageSettings(raw: unknown): LanguageSettings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Expected an object');
  }

  const value = raw as Record<string, unknown>;
  const next = defaults();
  next.dashboard = optional(value.dashboard, 'dashboard');
  if (value.messages !== undefined) {
    if (!isLanguage(value.messages)) {
      throw new Error('messages must be en or ko');
    }
    next.messages = value.messages;
  }

  const features = (value.features ?? {}) as Record<string, unknown>;
  if (typeof features !== 'object' || features === null) {
    throw new Error('features must be an object');
  }
  for (const feature of MESSAGE_FEATURES) {
    next.features[feature] = optional(features[feature], feature);
  }
  return next;
}

/**
 * Before v0.8.3 the recap chose its own language (music-recap.json `language`). A server
 * that never had this file carries that choice over once, as the recap's override.
 */
async function carryRecapLanguage(): Promise<LanguageSettings | null> {
  try {
    const recap = JSON.parse(await readFile(recapPath, 'utf8')) as { language?: unknown };
    if (isLanguage(recap.language) && recap.language !== 'en') {
      const next = defaults();
      next.features.recap = recap.language;
      return next;
    }
  } catch {
    // No recap settings, or unreadable ones: nothing to carry.
  }
  return null;
}

async function write(next: LanguageSettings): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(temporary, filePath);
}

export async function loadLanguageSettings(): Promise<LanguageSettings> {
  let missing = false;
  const loaded = await loadSettingsFile({
    path: filePath,
    label: 'Language settings',
    parse: parseLanguageSettings,
    empty: () => {
      missing = true;
      return defaults();
    },
  });
  current = loaded.value;
  loadError = loaded.error;

  if (missing && !loaded.error) {
    const carried = await carryRecapLanguage();
    if (carried) {
      await write(carried);
      current = carried;
      container.logger.info(
        `[i18n] the recap's language (${carried.features.recap}) moved into language.json`,
      );
    }
  }
  return current;
}

export function getLanguageSettings(): LanguageSettings {
  return structuredClone(current);
}

export function getLanguageSettingsLoadError(): string | null {
  return loadError;
}

/** The language a feature's channel messages are written in. */
export function messageLanguage(feature: MessageFeature): Language {
  return current.features[feature] ?? current.messages;
}

export async function saveLanguageSettings(raw: unknown): Promise<LanguageSettings> {
  const next = parseLanguageSettings(raw);
  await write(next);
  current = next;
  loadError = null;
  return getLanguageSettings();
}

/** Points the settings at other files — for local checks only. */
export function setLanguageSettingsPathsForChecks(paths: { file: string; recap: string }): void {
  filePath = paths.file;
  recapPath = paths.recap;
  current = defaults();
}
