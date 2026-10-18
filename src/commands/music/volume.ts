import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { requestBannerRefresh } from '../../lib/music/banner/manager.js';
import { getVolume } from '../../lib/music/pcm-volume.js';
import { setVolume } from '../../lib/music/queue-actions.js';
import { MAX_VOLUME, MIN_VOLUME } from '../../lib/music/volume.js';

@ApplyOptions<Command.Options>({
  description: 'Set the volume, or show it',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description)).addIntegerOption(
        (option) =>
          option
            .setName('value')
            .setDescription(`${MIN_VOLUME}–${MAX_VOLUME}; 100 is as prepared, above it is a boost`)
            .setMinValue(MIN_VOLUME)
            .setMaxValue(MAX_VOLUME),
      ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const value = interaction.options.getInteger('value');
    if (value === null) {
      await replyNotice(interaction, { ok: true, message: `Volume: ${getVolume()}` });
      return;
    }

    await replyNotice(interaction, setVolume(value));
    requestBannerRefresh();
  }
}
