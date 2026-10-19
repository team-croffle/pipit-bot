import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { container } from '@sapphire/framework';

import { dataDir } from './constants.js';
import { getGithubNotifySettings, saveGithubNotifySettings } from './github/settings.js';
import { loadSettingsFile } from './settings-file.js';

/**
 * The features an operator can switch off as a whole. Off means off everywhere: their
 * slash commands leave Discord, their listeners stop acting, their API answers refuse.
 */
export const FEATURES = [
  'music',
  'github',
  'audit',
  'invites',
  'memberMessages',
  'joinRoles',
  'reactionRoles',
] as const;

export type Feature = (typeof FEATURES)[number];

export function isFeature(value: unknown): value is Feature {
  return typeof value === 'string' && (FEATURES as readonly string[]).includes(value);
}

/**
 * Kept in `data/features.json`, every feature on by default — a missing file is the bot
 * as it always was.
 *
 * WHY GitHub is not in the file: the GitHub notification settings already carry a master
 * switch (`enabled`) that the GitHub page and the dispatcher use. Two switches for one
 * feature could disagree, so this one reads and writes that.
 */
type StoredFeature = Exclude<Feature, 'github'>;

let filePath = join(dataDir, 'features.json');
let stored: Record<StoredFeature, boolean> = allOn();
let writing: Promise<void> = Promise.resolve();
const listeners = new Set<(feature: Feature, on: boolean) => void>();

function allOn(): Record<StoredFeature, boolean> {
  return {
    music: true,
    audit: true,
    invites: true,
    memberMessages: true,
    joinRoles: true,
    reactionRoles: true,
  };
}

function parse(raw: unknown): Record<StoredFeature, boolean> {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Expected an object');
  }

  const values = raw as Partial<Record<StoredFeature, unknown>>;
  const next = allOn();
  for (const key of Object.keys(next) as StoredFeature[]) {
    // Only an explicit false turns a feature off; anything else keeps the default.
    next[key] = values[key] !== false;
  }
  return next;
}

export async function loadFeatures(): Promise<void> {
  const loaded = await loadSettingsFile({
    path: filePath,
    label: 'Feature switches',
    parse,
    empty: allOn,
  });
  stored = loaded.value;
}

export function isEnabled(feature: Feature): boolean {
  return feature === 'github' ? getGithubNotifySettings().enabled : stored[feature];
}

export function featureStates(): Record<Feature, boolean> {
  return Object.fromEntries(FEATURES.map((feature) => [feature, isEnabled(feature)])) as Record<
    Feature,
    boolean
  >;
}

function save(): Promise<void> {
  const snapshot = `${JSON.stringify(stored, null, 2)}\n`;
  writing = writing
    .then(async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, snapshot, 'utf8');
    })
    .catch((error: unknown) => {
      container.logger?.warn('[features] could not save:', error);
    });
  return writing;
}

/** Switches a feature and tells whoever listens (commands, music, …) once it is stored. */
export async function setFeature(feature: Feature, on: boolean): Promise<void> {
  if (isEnabled(feature) === on) {
    return;
  }

  if (feature === 'github') {
    await saveGithubNotifySettings({ ...getGithubNotifySettings(), enabled: on });
  } else {
    stored = { ...stored, [feature]: on };
    await save();
  }

  for (const listener of listeners) {
    try {
      listener(feature, on);
    } catch (error) {
      container.logger?.warn(`[features] a listener for ${feature} failed:`, error);
    }
  }
}

export function onFeatureChange(listener: (feature: Feature, on: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Points the store at another file — for local checks only. */
export function setFeaturesPathForChecks(path: string): void {
  filePath = path;
  stored = allOn();
}
