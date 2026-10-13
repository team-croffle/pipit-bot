import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { MessageFlags, type AutocompleteInteraction } from 'discord.js';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { discordViewer, playlistChoices } from '../../lib/music/playlists/discord.js';
import { PlaylistError } from '../../lib/music/playlists/store.js';
import {
  confirmPlaylistDelete,
  runPlaylistSubcommand,
} from '../../lib/music/playlists/subcommands.js';

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
            .setName('import')
            .setDescription('Import tracks from a link the music worker can expand')
            .addStringOption((o) =>
              o.setName('link').setDescription('The link').setRequired(true).setMaxLength(500),
            )
            .addStringOption((o) =>
              o
                .setName('into')
                .setDescription('An existing playlist (default: a new one)')
                .setAutocomplete(true),
            )
            .addBooleanOption((o) =>
              o.setName('personal').setDescription('A new playlist only for you'),
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
    if (sub === 'play' || sub === 'import') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
      if (sub === 'delete') {
        await confirmPlaylistDelete(interaction);
        return;
      }
      await replyNotice(interaction, await runPlaylistSubcommand(interaction, sub));
    } catch (error) {
      if (error instanceof PlaylistError) {
        await replyNotice(interaction, { ok: false, message: error.message });
        return;
      }
      throw error;
    }
  }
}
