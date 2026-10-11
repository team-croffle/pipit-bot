import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { removeQueuedTrack } from '../../lib/music/queue-actions.js';

@ApplyOptions<Command.Options>({
  description: 'Remove a track from the queue',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description)).addIntegerOption(
        (option) =>
          option
            .setName('position')
            .setDescription('Queue position, as /queue shows it')
            .setRequired(true)
            .setMinValue(1),
      ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await replyNotice(
      interaction,
      removeQueuedTrack({ index: interaction.options.getInteger('position', true) }),
    );
  }
}
