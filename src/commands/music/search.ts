import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

import { guildOnly } from '../../lib/discord/slash.js';
import { answerSearch } from '../../lib/music/search-flow.js';

@ApplyOptions<Command.Options>({
  description: 'Search for a track and pick one of up to five results',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description)).addStringOption(
        (option) =>
          option
            .setName('query')
            .setDescription('What to search for')
            .setRequired(true)
            .setMaxLength(200),
      ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await answerSearch(interaction, interaction.options.getString('query', true));
  }
}
