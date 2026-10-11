import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { getVolumeLevel } from '../../lib/music/pcm-volume.js';
import { setVolumeLevel } from '../../lib/music/queue-actions.js';
import { VOLUME_LEVELS, type VolumeLevel } from '../../lib/music/volume-levels.js';

@ApplyOptions<Command.Options>({
  description: 'Set the volume, or show it',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description)).addStringOption(
        (option) =>
          option
            .setName('level')
            .setDescription('low, mid or high')
            .addChoices(
              { name: 'low', value: 'low' },
              { name: 'mid', value: 'mid' },
              { name: 'high', value: 'high' },
            ),
      ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const level = interaction.options.getString('level') as VolumeLevel | null;
    if (!level) {
      const current = getVolumeLevel();
      await replyNotice(interaction, {
        ok: true,
        message: `Volume: ${current} (${VOLUME_LEVELS[current]})`,
      });
      return;
    }

    await replyNotice(interaction, setVolumeLevel(level));
  }
}
