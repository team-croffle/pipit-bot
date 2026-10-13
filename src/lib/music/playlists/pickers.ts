import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} from 'discord.js';

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

function options(viewer: PlaylistViewer, selected?: string) {
  return listPlaylists(viewer)
    .slice(0, 25)
    .map((playlist) => ({
      label: `${playlist.scope === 'personal' ? '🔒 ' : ''}${playlist.name}`.slice(0, 100),
      description: `${playlist.items.length} tracks`,
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

const NONE = 'No playlists yet — make one with /playlist create or on the dashboard.';

/** Saving search result `index` of `searchId`: choose the playlist. */
export function saveToPlaylistMessage(viewer: PlaylistViewer, searchId: string, index: number) {
  const choices = options(viewer);
  if (choices.length === 0) {
    return null;
  }

  return message('📁 재생목록에 담기', '어느 재생목록에 담을까요?', [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${PLAYLIST_UI.save}:${searchId}:${index}`)
        .setPlaceholder('재생목록 고르기')
        .addOptions(choices),
    ),
  ]);
}

/** The remote's playlist button: choose a playlist, then play it in order or shuffled. */
export function playPlaylistMessage(viewer: PlaylistViewer, selected?: string) {
  const choices = options(viewer, selected);
  if (choices.length === 0) {
    return null;
  }

  const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(PLAYLIST_UI.pick)
        .setPlaceholder('재생목록 고르기')
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
          .setLabel('재생'),
        new ButtonBuilder()
          .setCustomId(`${PLAYLIST_UI.shuffle}:${selected}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔀')
          .setLabel('섞어서 재생'),
      ),
    );
  }

  return message('📁 재생목록', '재생목록을 고르면 지금 대기열 뒤에 이어 재생합니다.', rows);
}

export { NONE as NO_PLAYLISTS };
