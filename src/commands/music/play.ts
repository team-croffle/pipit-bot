import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { requestPlay } from '../../lib/music/request.js';

@ApplyOptions<Command.Options>({
  description: 'Play a song title or a link in your voice channel',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description))
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('A song title or a link')
            .setRequired(true)
            .setMaxLength(500),
        )
        .addBooleanOption((option) =>
          option.setName('next').setDescription('Play it right after the current track'),
        ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      return;
    }

    // Preparing can take a while; the interaction must be answered within three seconds.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const notice = await requestPlay({
      query: interaction.options.getString('query', true),
      next: interaction.options.getBoolean('next') ?? false,
      member: interaction.member,
      channel: interaction.channel,
    });
    await replyNotice(interaction, notice);
  }
}
