import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { dataDir } from '../../constants.js';
import { loadSettingsFile } from '../../settings-file.js';

/**
 * Which message is the remote-control banner in each music channel
 * (`data/music-banner.json`). Kept so a restart edits the same message instead of
 * posting another one.
 */
const storePath = join(dataDir, 'music-banner.json');

let banners = new Map<string, string>();

function parse(raw: unknown): Map<string, string> {
  const channels = (raw as { channels?: unknown } | null)?.channels;
  if (!channels || typeof channels !== 'object') {
    return new Map();
  }

  return new Map(
    Object.entries(channels).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

export async function loadBannerStore(): Promise<void> {
  const loaded = await loadSettingsFile({
    path: storePath,
    label: 'music channel banners',
    parse,
    empty: () => new Map<string, string>(),
  });
  banners = loaded.value;
}

export function bannerMessageId(channelId: string): string | undefined {
  return banners.get(channelId);
}

export function bannerChannels(): string[] {
  return [...banners.keys()];
}

async function save(): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    storePath,
    JSON.stringify({ channels: Object.fromEntries(banners) }, null, 2),
    'utf8',
  );
}

export async function rememberBanner(channelId: string, messageId: string): Promise<void> {
  banners.set(channelId, messageId);
  await save();
}

export async function forgetBanner(channelId: string): Promise<void> {
  if (banners.delete(channelId)) {
    await save();
  }
}
