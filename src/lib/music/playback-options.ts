import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { container } from '@sapphire/framework';

import { dataDir } from '../constants.js';
import { loadSettingsFile } from '../settings-file.js';
import { isVolumeLevel, type VolumeLevel } from './volume-levels.js';

/**
 * How the bot plays, kept in `data/playback-options.json` so it survives a restart.
 *
 * One set for the bot: Pipit runs in one server, and these describe what everyone in
 * the voice channel hears. The PCM stage reads them per chunk, so a change applies to the
 * track that is playing.
 */
export interface PlaybackOptions {
  volume: VolumeLevel;
  /** Left and right mixed into both ears — for listening with one earphone. */
  mono: boolean;
  autoplay: boolean;
}

const DEFAULTS: PlaybackOptions = { volume: 'high', mono: false, autoplay: false };

let filePath = join(dataDir, 'playback-options.json');
let options: PlaybackOptions = { ...DEFAULTS };
let writing: Promise<void> = Promise.resolve();

function parse(raw: unknown): PlaybackOptions {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Expected an object');
  }

  const stored = raw as Partial<Record<keyof PlaybackOptions, unknown>>;
  return {
    volume: isVolumeLevel(stored.volume) ? stored.volume : DEFAULTS.volume,
    mono: stored.mono === true,
    autoplay: stored.autoplay === true,
  };
}

export async function loadPlaybackOptions(): Promise<void> {
  const loaded = await loadSettingsFile({
    path: filePath,
    label: 'Playback options',
    parse,
    empty: () => ({ ...DEFAULTS }),
  });
  options = loaded.value;
}

export function getPlaybackOptions(): Readonly<PlaybackOptions> {
  return options;
}

function save(): Promise<void> {
  const snapshot = `${JSON.stringify(options, null, 2)}\n`;
  writing = writing
    .then(async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, snapshot, 'utf8');
    })
    .catch((error: unknown) => {
      container.logger?.warn('[playback-options] could not save:', error);
    });
  return writing;
}

export function updatePlaybackOptions(patch: Partial<PlaybackOptions>): Promise<void> {
  options = { ...options, ...patch };
  return save();
}

/** Points the store at another file — for local checks only. */
export function setPlaybackOptionsPathForChecks(path: string): void {
  filePath = path;
  options = { ...DEFAULTS };
}
