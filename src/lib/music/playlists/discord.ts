import { escapeMarkdown, type GuildMember, type User } from 'discord.js';

import type { Notice } from '../../discord/notice.js';
import { formatDurationFromSeconds } from '../track-format.js';
import { getPlaylist, findPlaylistByName, listPlaylists, PlaylistError } from './store.js';
import type { Playlist, PlaylistViewer } from './types.js';

/** A Discord user as a playlist viewer: their own id is their personal key. */
export function discordViewer(user: User, member?: GuildMember | null): PlaylistViewer {
  return { discordId: user.id, name: member?.displayName ?? user.globalName ?? user.username };
}

/**
 * The playlist a command names. Autocomplete sends the id; someone who typed instead sends
 * a name — both work, and a name is matched without case.
 */
export function playlistFromOption(value: string, viewer: PlaylistViewer): Playlist {
  try {
    return getPlaylist(value, viewer);
  } catch {
    const byName = findPlaylistByName(value, viewer);
    if (!byName) {
      throw new PlaylistError(404, `No playlist called "${value}".`);
    }
    return byName;
  }
}

/** Autocomplete choices: name, track count, and 🔒 for a personal one. */
export function playlistChoices(viewer: PlaylistViewer, typed: string) {
  const needle = typed.trim().toLowerCase();
  return listPlaylists(viewer)
    .filter((playlist) => !needle || playlist.name.toLowerCase().includes(needle))
    .slice(0, 25)
    .map((playlist) => ({
      name: `${playlist.scope === 'personal' ? '🔒 ' : ''}${playlist.name} · ${playlist.items.length}`.slice(
        0,
        100,
      ),
      value: playlist.id,
    }));
}

const SHOWN = 25;

/** `/playlist show`: the tracks, numbered, with lengths — titles only. */
export function showPlaylist(playlist: Playlist): Notice {
  if (playlist.items.length === 0) {
    return { ok: true, message: `${playlist.name} — no tracks yet` };
  }

  const total = playlist.items.reduce((sum, item) => sum + (item.durationSec ?? 0), 0);
  const lines = playlist.items.slice(0, SHOWN).map((item, index) => {
    const length = item.durationSec ? ` · ${formatDurationFromSeconds(item.durationSec)}` : '';
    return `**${index + 1}.** ${escapeMarkdown(item.title)}${length}`;
  });
  if (playlist.items.length > SHOWN) {
    lines.push(`-# and ${playlist.items.length - SHOWN} more`);
  }

  return {
    ok: true,
    message: `${playlist.scope === 'personal' ? '🔒 ' : '📁 '}${playlist.name} — ${playlist.items.length} tracks · ${formatDurationFromSeconds(total)}`,
    detail: lines.join('\n'),
  };
}

/** `/playlist list`: shared first, then the person's own. */
export function listForDiscord(viewer: PlaylistViewer): Notice {
  const playlists = listPlaylists(viewer);
  if (playlists.length === 0) {
    return { ok: true, message: 'No playlists yet — make one with /playlist create.' };
  }

  return {
    ok: true,
    message: `${playlists.length} playlist${playlists.length === 1 ? '' : 's'}`,
    detail: playlists
      .slice(0, 40)
      .map(
        (playlist) =>
          `${playlist.scope === 'personal' ? '🔒' : '📁'} **${escapeMarkdown(playlist.name)}** · ${playlist.items.length}`,
      )
      .join('\n'),
  };
}
