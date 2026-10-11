import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { moveQueuedTrack } from '../../lib/music/queue-actions.js';

@ApplyOptions<Command.Options>({
  description: 'Move a queued track to another position',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description))
        .addIntegerOption((option) =>
          option
            .setName('from')
            .setDescription('Current position')
            .setRequired(true)
            .setMinValue(1),
        )
        .addIntegerOption((option) =>
          option.setName('to').setDescription('New position').setRequired(true).setMinValue(1),
        ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await replyNotice(
      interaction,
      moveQueuedTrack(
        { index: interaction.options.getInteger('from', true) },
        interaction.options.getInteger('to', true),
      ),
    );
  }
}
