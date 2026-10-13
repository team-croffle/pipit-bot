import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type AutocompleteInteraction,
} from 'discord.js';

import { noticeContainer, replyNotice, type Notice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { requestBannerRefresh } from '../../lib/music/banner/manager.js';
import { canEnqueuePlayback } from '../../lib/music/playback.js';
import {
  discordViewer,
  listForDiscord,
  playlistChoices,
  playlistFromOption,
  showPlaylist,
} from '../../lib/music/playlists/discord.js';
import { playPlaylist } from '../../lib/music/playlists/feeder.js';
import { resolveItems, type ItemSource } from '../../lib/music/playlists/sources.js';
import {
  addItems,
  createPlaylist,
  moveItem,
  PlaylistError,
  removeItem,
  renamePlaylist,
} from '../../lib/music/playlists/store.js';
import { connectPlayerToChannel } from '../../lib/music/voice-connection.js';

export const PLAYLIST_DELETE = 'playlist:delete';

/** Typed by shape: the command framework carries its own copy of the builders package. */
interface StringOption {
  setName(name: string): this;
  setDescription(description: string): this;
  setRequired(required: boolean): this;
  setAutocomplete(autocomplete: boolean): this;
}

const nameOption = <O extends StringOption>(option: O): O =>
  option.setName('name').setDescription('The playlist').setRequired(true).setAutocomplete(true);

@ApplyOptions<Command.Options>({
  description: 'Playlists: list, show, make, change and play them',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description))
        .addSubcommand((s) => s.setName('list').setDescription('Shared playlists and your own'))
        .addSubcommand((s) =>
          s.setName('show').setDescription('The tracks of a playlist').addStringOption(nameOption),
        )
        .addSubcommand((s) =>
          s
            .setName('create')
            .setDescription('Make a playlist')
            .addStringOption((o) =>
              o.setName('name').setDescription('Its name').setRequired(true).setMaxLength(60),
            )
            .addBooleanOption((o) =>
              o
                .setName('personal')
                .setDescription('Only for you (default: shared, anyone can edit)'),
            ),
        )
        .addSubcommand((s) =>
          s
            .setName('rename')
            .setDescription('Rename a playlist')
            .addStringOption(nameOption)
            .addStringOption((o) =>
              o.setName('to').setDescription('The new name').setRequired(true).setMaxLength(60),
            ),
        )
        .addSubcommand((s) =>
          s.setName('delete').setDescription('Delete a playlist').addStringOption(nameOption),
        )
        .addSubcommand((s) =>
          s
            .setName('add')
            .setDescription('Save tracks to a playlist')
            .addStringOption(nameOption)
            .addStringOption((o) =>
              o
                .setName('what')
                .setDescription('What to save')
                .setRequired(true)
                .addChoices(
                  { name: 'the current track', value: 'current' },
                  { name: 'the whole queue', value: 'queue' },
                  { name: 'a song title or a link', value: 'text' },
                ),
            )
            .addStringOption((o) =>
              o
                .setName('text')
                .setDescription('The song title or link, for "a song title or a link"')
                .setMaxLength(500),
            ),
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Remove a track')
            .addStringOption(nameOption)
            .addIntegerOption((o) =>
              o
                .setName('position')
                .setDescription('Its number in /playlist show')
                .setRequired(true)
                .setMinValue(1),
            ),
        )
        .addSubcommand((s) =>
          s
            .setName('move')
            .setDescription('Move a track')
            .addStringOption(nameOption)
            .addIntegerOption((o) =>
              o.setName('from').setDescription('Its number now').setRequired(true).setMinValue(1),
            )
            .addIntegerOption((o) =>
              o.setName('to').setDescription('Its new number').setRequired(true).setMinValue(1),
            ),
        )
        .addSubcommand((s) =>
          s
            .setName('play')
            .setDescription('Play a playlist after the queue')
            .addStringOption(nameOption)
            .addBooleanOption((o) => o.setName('shuffle').setDescription('In random order')),
        ),
    );
  }

  public override async autocompleteRun(interaction: AutocompleteInteraction) {
    const viewer = discordViewer(
      interaction.user,
      interaction.inCachedGuild() ? interaction.member : null,
    );
    await interaction.respond(playlistChoices(viewer, String(interaction.options.getFocused())));
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      return;
    }

    const sub = interaction.options.getSubcommand();
    if (sub === 'play') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
      if (sub === 'delete') {
        await this.confirmDelete(interaction);
        return;
      }
      await replyNotice(interaction, await this.run(interaction, sub));
    } catch (error) {
      if (error instanceof PlaylistError) {
        await replyNotice(interaction, { ok: false, message: error.message });
        return;
      }
      throw error;
    }
  }

  private async run(
    interaction: Command.ChatInputCommandInteraction<'cached'>,
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
          message: `Made ${personal ? 'your personal' : 'the shared'} playlist "${made.name}".`,
        };
      }
      case 'rename': {
        const playlist = target();
        const renamed = await renamePlaylist(playlist.id, options.getString('to', true), viewer);
        return { ok: true, message: `Renamed to "${renamed.name}".` };
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
        const skipped = result.skipped > 0 ? ` ${result.skipped} did not fit.` : '';
        return {
          ok: true,
          message: `Saved ${result.added} track${result.added === 1 ? '' : 's'} to "${playlist.name}".${skipped}`,
        };
      }
      case 'remove': {
        const playlist = target();
        const item = playlist.items[options.getInteger('position', true) - 1];
        if (!item) {
          return {
            ok: false,
            message: `"${playlist.name}" has no track ${options.getInteger('position', true)}.`,
          };
        }
        await removeItem(playlist.id, item.id, viewer);
        return { ok: true, message: `Removed ${item.title} from "${playlist.name}".` };
      }
      case 'move': {
        const playlist = target();
        const item = playlist.items[options.getInteger('from', true) - 1];
        if (!item) {
          return {
            ok: false,
            message: `"${playlist.name}" has no track ${options.getInteger('from', true)}.`,
          };
        }
        await moveItem(playlist.id, item.id, options.getInteger('to', true) - 1, viewer);
        return { ok: true, message: `Moved ${item.title} to ${options.getInteger('to', true)}.` };
      }
      case 'play': {
        const playlist = target();
        if (!canEnqueuePlayback()) {
          const voice = interaction.member.voice.channel;
          if (!voice) {
            return { ok: false, message: 'Join a voice channel first.' };
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
        return { ok: false, message: 'Unknown subcommand.' };
    }
  }

  /** Deleting asks first: a private message with a delete button, for 30 seconds. */
  private async confirmDelete(interaction: Command.ChatInputCommandInteraction<'cached'>) {
    const playlist = playlistFromOption(
      interaction.options.getString('name', true),
      discordViewer(interaction.user, interaction.member),
    );
    const button = new ButtonBuilder()
      .setCustomId(`${PLAYLIST_DELETE}:${playlist.id}`)
      .setStyle(ButtonStyle.Danger)
      .setLabel(`"${playlist.name}" 지우기`.slice(0, 80));
    await interaction.reply({
      components: [
        noticeContainer(
          {
            ok: false,
            message: `Delete "${playlist.name}" and its ${playlist.items.length} tracks?`,
            detail: '-# This cannot be undone.',
          },
          '30초 안에 누르세요',
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(button),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    setTimeout(() => void interaction.deleteReply().catch(() => undefined), 30_000).unref();
  }
}
