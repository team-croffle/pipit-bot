import { join } from 'node:path';

import { eq } from 'drizzle-orm';

import { dataDir } from '../../constants.js';
import { getDb } from '../../db/client.js';
import { migrateFile } from '../../db/migrate-file.js';
import { musicBanners } from '../../db/schema.js';

/**
 * Which message is the remote-control banner in each music channel. Kept so a restart
 * edits the same message instead of posting another one.
 *
 * In the database since v0.8.0 (`music_banners`; the old `data/music-banner.json` is
 * moved in once). The map stays in memory for the banner's every-few-seconds redraw;
 * a change is written before the caller goes on, and a failed write reaches it as before.
 */
const legacyPath = join(dataDir, 'music-banner.json');

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
  await migrateFile({
    name: 'music-banner.json',
    path: legacyPath,
    label: 'music channel banners',
    parse,
    insert: async (tx, parsed) => {
      const rows = [...parsed].map(([channelId, messageId]) => ({ channelId, messageId }));
      if (rows.length > 0) {
        await tx.insert(musicBanners).values(rows).onConflictDoNothing();
      }
      return rows.length;
    },
  });

  const rows = await getDb().select().from(musicBanners);
  banners = new Map(rows.map((row) => [row.channelId, row.messageId]));
}

export function bannerMessageId(channelId: string): string | undefined {
  return banners.get(channelId);
}

export function bannerChannels(): string[] {
  return [...banners.keys()];
}

export async function rememberBanner(channelId: string, messageId: string): Promise<void> {
  banners.set(channelId, messageId);
  await getDb()
    .insert(musicBanners)
    .values({ channelId, messageId })
    .onConflictDoUpdate({
      target: musicBanners.channelId,
      set: { messageId, updatedAt: new Date() },
    });
}

export async function forgetBanner(channelId: string): Promise<void> {
  if (banners.delete(channelId)) {
    await getDb().delete(musicBanners).where(eq(musicBanners.channelId, channelId));
  }
}
