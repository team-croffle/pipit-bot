import { container } from '@sapphire/framework';

import { addItems, createPlaylist, findPlaylistByName } from '../playlists/store.js';
import type { PlaylistViewer } from '../playlists/types.js';
import type { RecapSummary } from './aggregate.js';
import { onYearRecap } from './post.js';
import { getTracks } from './tracks-store.js';

/**
 * The year's playlist: when a year's recap is posted, its most played tracks become a
 * shared playlist, "2026 결산", that anyone can play from `/playlist` or the dashboard.
 *
 * WHY through music_tracks: a playlist item plays by the request that prepares it, and a
 * file key is not one. The request comes from the track table, which holds no person.
 * A track whose request is no longer known is left out.
 *
 * Once per year: the recap may be posted again (a retry, a repost), and the playlist
 * already made is kept as it is — people may have edited it since.
 */

const BOT: PlaylistViewer = { name: 'pipit-bot' };

export function yearPlaylistName(year: string): string {
  return `${year} 결산`;
}

export async function makeYearPlaylist(summary: RecapSummary): Promise<string | undefined> {
  if (summary.kind !== 'year' || summary.topTracks.length === 0) {
    return undefined;
  }

  const name = yearPlaylistName(summary.period);
  const existing = findPlaylistByName(name, BOT);
  if (existing) {
    return existing.name;
  }

  const known = await getTracks(summary.topTracks.map((track) => track.fileKey));
  const items = summary.topTracks.flatMap((track) => {
    const record = known.get(track.fileKey);
    return record?.request
      ? [
          {
            title: record.title,
            query: record.request,
            ...(record.durationSec ? { durationSec: record.durationSec } : {}),
          },
        ]
      : [];
  });
  if (items.length === 0) {
    container.logger.info(`[recap] no track of ${summary.period} can be asked for again`);
    return undefined;
  }

  const playlist = await createPlaylist({ name, scope: 'shared' }, BOT);
  await addItems(playlist.id, items, BOT);
  const missing = summary.topTracks.length - items.length;
  container.logger.info(
    `[recap] made the playlist ${name} (${items.length} tracks${missing > 0 ? `, ${missing} left out` : ''})`,
  );
  return playlist.name;
}

/** Hooks the playlist onto the year's recap (called once at start). */
export function watchYearRecaps(): void {
  onYearRecap((_guildId, summary) => makeYearPlaylist(summary));
}
