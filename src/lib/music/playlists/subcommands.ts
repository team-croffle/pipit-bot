import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';

import { noticeContainer, type Notice } from '../../discord/notice.js';
import { languageOfLocale } from '../../i18n/index.js';
import { phraseIn, say, sayDetail } from '../../i18n/phrase.js';
import { requestBannerRefresh } from '../banner/manager.js';
import { canEnqueuePlayback } from '../playback.js';
import { connectPlayerToChannel } from '../voice-connection.js';
import { discordViewer, listForDiscord, playlistFromOption, showPlaylist } from './discord.js';
import { playPlaylist } from './feeder.js';
import { importAsNew, importInto } from './importer.js';
import { resolveItems, type ItemSource } from './sources.js';
import { addItems, createPlaylist, moveItem, removeItem, renamePlaylist } from './store.js';

/** `/playlist` subcommands, apart from the command's own definition. */

export const PLAYLIST_DELETE = 'playlist:delete';

export async function runPlaylistSubcommand(
  interaction: ChatInputCommandInteraction<'cached'>,
  sub: string,
): Promise<Notice> {
  const viewer = discordViewer(interaction.user, interaction.member);
  const options = interaction.options;
  const target = () => playlistFromOption(options.getString('name', true), viewer);

  switch (sub) {
    case 'list':
      return listForDiscord(viewer);
    case 'show':
      return showPlaylist(target());
    case 'create': {
      const personal = options.getBoolean('personal') ?? false;
      const made = await createPlaylist(
        { name: options.getString('name', true), scope: personal ? 'personal' : 'shared' },
        viewer,
      );
      return {
        ok: true,
        ...say(personal ? 'madePersonal' : 'madeShared', { name: made.name }),
      };
    }
    case 'rename': {
      const playlist = target();
      const renamed = await renamePlaylist(playlist.id, options.getString('to', true), viewer);
      return { ok: true, ...say('renamed', { name: renamed.name }) };
    }
    case 'add': {
      const playlist = target();
      const what = options.getString('what', true);
      const source: ItemSource =
        what === 'current'
          ? { from: 'current' }
          : what === 'queue'
            ? { from: 'queue', ref: 'all' }
            : { from: 'typed', query: options.getString('text') ?? '' };
      const result = await addItems(playlist.id, resolveItems(source), viewer);
      return {
        ok: true,
        ...say('savedTracks', { count: result.added, name: playlist.name }),
        ...(result.skipped > 0 && sayDetail('didNotFit', { count: result.skipped })),
      };
    }
    case 'remove': {
      const playlist = target();
      const item = playlist.items[options.getInteger('position', true) - 1];
      if (!item) {
        return {
          ok: false,
          ...say('noTrackNumber', {
            name: playlist.name,
            position: options.getInteger('position', true),
          }),
        };
      }
      await removeItem(playlist.id, item.id, viewer);
      return { ok: true, ...say('removedFrom', { title: item.title, name: playlist.name }) };
    }
    case 'move': {
      const playlist = target();
      const item = playlist.items[options.getInteger('from', true) - 1];
      if (!item) {
        return {
          ok: false,
          ...say('noTrackNumber', {
            name: playlist.name,
            position: options.getInteger('from', true),
          }),
        };
      }
      await moveItem(playlist.id, item.id, options.getInteger('to', true) - 1, viewer);
      return {
        ok: true,
        ...say('movedTo', { title: item.title, position: options.getInteger('to', true) }),
      };
    }
    case 'import': {
      const into = options.getString('into');
      const result = into
        ? await importInto(
            playlistFromOption(into, viewer).id,
            options.getString('link', true),
            viewer,
          )
        : await importAsNew(
            {
              query: options.getString('link', true),
              scope: options.getBoolean('personal') ? 'personal' : 'shared',
            },
            viewer,
          );
      return {
        ok: true,
        ...say('importedTracks', { count: result.added, name: result.playlist.name }),
        ...(result.skipped > 0 && sayDetail('didNotFit', { count: result.skipped })),
      };
    }
    case 'play': {
      const playlist = target();
      if (!canEnqueuePlayback()) {
        const voice = interaction.member.voice.channel;
        if (!voice) {
          return { ok: false, ...say('joinVoiceFirst') };
        }
        await connectPlayerToChannel(voice);
      }
      const notice = playPlaylist(playlist, {
        shuffle: options.getBoolean('shuffle') ?? false,
        requestedBy: interaction.user.id,
      });
      requestBannerRefresh();
      return notice;
    }
    default:
      return { ok: false, ...say('unknownSubcommand') };
  }
}

/** Deleting asks first: a private message with a delete button, for 30 seconds. */
export async function confirmPlaylistDelete(
  interaction: ChatInputCommandInteraction<'cached'>,
): Promise<void> {
  const playlist = playlistFromOption(
    interaction.options.getString('name', true),
    discordViewer(interaction.user, interaction.member),
  );
  const language = languageOfLocale(interaction.locale);
  const button = new ButtonBuilder()
    .setCustomId(`${PLAYLIST_DELETE}:${playlist.id}`)
    .setStyle(ButtonStyle.Danger)
    .setLabel(
      phraseIn(language, { key: 'deleteButton', params: { name: playlist.name } }).slice(0, 80),
    );
  await interaction.reply({
    components: [
      noticeContainer(
        {
          ok: false,
          ...say('deleteAsk', { name: playlist.name, count: playlist.items.length }),
          detail: `-# ${phraseIn(language, { key: 'cannotUndo' })}`,
        },
        phraseIn(language, { key: 'pressWithin', params: { count: 30 } }),
        language,
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(button),
    ],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
  setTimeout(() => void interaction.deleteReply().catch(() => undefined), 30_000).unref();
}
