import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { requestBannerRefresh } from '../../lib/music/banner/manager.js';
import { getPlaybackOptions } from '../../lib/music/playback-options.js';
import { setMono } from '../../lib/music/queue-actions.js';

const onOff = (on: boolean) => (on ? 'on' : 'off');

@ApplyOptions<Command.Options>({
  description: 'Set the playback options, or show them',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description)).addStringOption(
        (option) =>
          option
            .setName('mono')
            .setDescription('Mix left and right into both ears, for one earphone')
            .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }),
      ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const mono = interaction.options.getString('mono');
    if (!mono) {
      const options = getPlaybackOptions();
      await replyNotice(interaction, {
        ok: true,
        message: `Mono: ${onOff(options.mono)} · Volume: ${options.volume}`,
      });
      return;
    }

    await replyNotice(interaction, setMono(mono === 'on'));
    requestBannerRefresh();
  }
}
