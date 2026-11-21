import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import type { TFunction } from 'i18next';

import type { Notice } from '../../discord/notice.js';
import { translator, type Language } from '../../i18n/index.js';
import { say } from '../../i18n/phrase.js';
import { listPlaylists } from './store.js';
import type { PlaylistViewer } from './types.js';

/**
 * The private messages that pick a playlist in Discord: one to save a search result to,
 * one (from the remote) to play. Ids: `playlist:<part>:…`.
 */
export const PLAYLIST_UI = {
  save: 'playlist:save',
  pick: 'playlist:pick',
  play: 'playlist:play',
  shuffle: 'playlist:shuffle',
} as const;

const ACCENT = 0xe9a23b;

function options(viewer: PlaylistViewer, t: TFunction, selected?: string) {
  return listPlaylists(viewer)
    .slice(0, 25)
    .map((playlist) => ({
      label: `${playlist.scope === 'personal' ? '🔒 ' : ''}${playlist.name}`.slice(0, 100),
      description: t('tracks', { count: playlist.items.length }),
      value: playlist.id,
      default: playlist.id === selected,
    }));
}

function message(
  title: string,
  body: string,
  rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[],
) {
  return {
    components: [
      new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### ${title}`),
          new TextDisplayBuilder().setContent(body),
        ),
      ...rows,
    ],
    flags: MessageFlags.IsComponentsV2 as const,
  };
}

/** Nothing to pick from: a notice in the person's language. */
export function noPlaylistsNotice(): Notice {
  return { ok: false, ...say('noPlaylistsAnywhere') };
}

/** Saving search result `index` of `searchId`: choose the playlist. */
export function saveToPlaylistMessage(
  viewer: PlaylistViewer,
  searchId: string,
  index: number,
  language: Language = 'en',
) {
  const t = translator(language, 'music');
  const choices = options(viewer, t);
  if (choices.length === 0) {
    return null;
  }

  return message(t('saveTitle'), t('saveBody'), [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${PLAYLIST_UI.save}:${searchId}:${index}`)
        .setPlaceholder(t('pickPlaylist'))
        .addOptions(choices),
    ),
  ]);
}

/** The remote's playlist button: choose a playlist, then play it in order or shuffled. */
export function playPlaylistMessage(
  viewer: PlaylistViewer,
  selected?: string,
  language: Language = 'en',
) {
  const t = translator(language, 'music');
  const choices = options(viewer, t, selected);
  if (choices.length === 0) {
    return null;
  }

  const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(PLAYLIST_UI.pick)
        .setPlaceholder(t('pickPlaylist'))
        .addOptions(choices),
    ),
  ];
  if (selected) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${PLAYLIST_UI.play}:${selected}`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('▶️')
          .setLabel(t('playButton')),
        new ButtonBuilder()
          .setCustomId(`${PLAYLIST_UI.shuffle}:${selected}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔀')
          .setLabel(t('shuffleButton')),
      ),
    );
  }

  return message(t('playlistsTitle'), t('playlistsBody'), rows);
}
