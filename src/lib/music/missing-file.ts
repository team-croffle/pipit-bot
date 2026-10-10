import { existsSync } from 'node:fs';

import { container } from '@sapphire/framework';
import type { GuildQueue, Player, Track } from 'discord-player';

import { getConfiguredGuild } from '../discord-guild.js';
import { getRuntimeConfig } from '../runtime-config.js';
import { localTrackPath } from './local-file-extractor.js';

/**
 * Says so when a queued track is skipped because its prepared file is gone.
 *
 * WHY this exists: the player already moves on when a stream cannot be opened, but
 * silently — and with the music worker cleaning old files, a track that waited long
 * in the queue can lose its file. The skip itself is the player's; this only names
 * it, in the music channel and on the dashboard.
 */

export interface PlaybackNotice {
  message: string;
  at: number;
}

const NOTICE_TTL_MS = 60_000;

let lastNotice: PlaybackNotice | null = null;

/** The latest notice, for the dashboard — gone a minute after it was raised. */
export function getRecentNotice(): PlaybackNotice | null {
  return lastNotice && Date.now() - lastNotice.at < NOTICE_TTL_MS ? lastNotice : null;
}

function isFileGone(track: Track): boolean {
  const path = localTrackPath(track.url);
  return path !== null && !existsSync(path);
}

/**
 * Where to say it: the channel of the message that started the session when there is
 * one, else the first music channel. A session started from the dashboard has no
 * message behind it.
 */
async function noticeChannel(queue: GuildQueue) {
  const metadata = queue.metadata as { channel?: { isSendable?: () => boolean } } | undefined;
  if (metadata?.channel?.isSendable?.()) {
    return metadata.channel as unknown as { send: (content: string) => Promise<unknown> };
  }

  const channelId = getRuntimeConfig().musicChannelIds[0];
  const channel = channelId ? getConfiguredGuild()?.channels.cache.get(channelId) : undefined;
  return channel?.isSendable() ? channel : null;
}

export function watchMissingFiles(player: Player): void {
  player.events.on('playerSkip', (queue, track, reason) => {
    if (reason !== 'ERR_NO_STREAM' || !isFileGone(track)) {
      return;
    }

    const title = track.title?.trim() || 'a track';
    lastNotice = { message: `Skipped ${title}: its file is no longer available.`, at: Date.now() };
    container.logger.warn(`[music] ${lastNotice.message}`);

    void noticeChannel(queue)
      .then((channel) => channel?.send(`Skipped **${title}**: its file is no longer available.`))
      .catch((error: unknown) =>
        container.logger.warn('[music] could not post the skip notice', error),
      );
  });
}
