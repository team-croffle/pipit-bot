import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { requestBannerRefresh } from '../../lib/music/banner/manager.js';
import { getPlaybackOptions } from '../../lib/music/playback-options.js';
import { setAutoplay, setMono } from '../../lib/music/queue-actions.js';

const onOff = (on: boolean) => (on ? 'on' : 'off');
const ON_OFF = [
  { name: 'on', value: 'on' },
  { name: 'off', value: 'off' },
];

@ApplyOptions<Command.Options>({
  description: 'Set the playback options, or show them',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description))
        .addStringOption((option) =>
          option
            .setName('mono')
            .setDescription('Mix left and right into both ears, for one earphone')
            .addChoices(...ON_OFF),
        )
        .addStringOption((option) =>
          option
            .setName('autoplay')
            .setDescription('Keep playing similar tracks when the queue runs out')
            .addChoices(...ON_OFF),
        ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const mono = interaction.options.getString('mono');
    const autoplay = interaction.options.getString('autoplay');
    if (!mono && !autoplay) {
      const options = getPlaybackOptions();
      await replyNotice(interaction, {
        ok: true,
        message: `Mono: ${onOff(options.mono)} · Autoplay: ${onOff(options.autoplay)} · Volume: ${options.volume}`,
      });
      return;
    }

    const results = [
      ...(mono ? [setMono(mono === 'on')] : []),
      ...(autoplay ? [setAutoplay(autoplay === 'on')] : []),
    ];
    await replyNotice(interaction, {
      ok: results.every((result) => result.ok),
      message: results.map((result) => result.message).join(' '),
    });
    requestBannerRefresh();
  }
}
