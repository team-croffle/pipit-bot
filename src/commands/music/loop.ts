import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { setLoopMode, type LoopMode } from '../../lib/music/playback.js';

@ApplyOptions<Command.Options>({
  description: 'Set the repeat mode',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description)).addStringOption(
        (option) =>
          option
            .setName('mode')
            .setDescription('What to repeat')
            .setRequired(true)
            .addChoices(
              { name: 'off', value: 'off' },
              { name: 'track', value: 'track' },
              { name: 'queue', value: 'queue' },
            ),
      ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await replyNotice(
      interaction,
      setLoopMode(interaction.options.getString('mode', true) as LoopMode),
    );
  }
}
