import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { skipPlayback } from '../../lib/music/playback.js';
import { skipToQueuedTrack } from '../../lib/music/queue-actions.js';

@ApplyOptions<Command.Options>({
  description: 'Skip the current track, or skip to a queued one',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description)).addIntegerOption(
        (option) =>
          option
            .setName('to')
            .setDescription('Skip to this queue position; the tracks before it are dropped')
            .setMinValue(1),
      ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const to = interaction.options.getInteger('to');
    await replyNotice(interaction, to === null ? skipPlayback() : skipToQueuedTrack({ index: to }));
  }
}
