import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { requestBannerRefresh } from '../../lib/music/banner/manager.js';
import { getPlaybackOptions } from '../../lib/music/playback-options.js';
import { setAutoplay, setMono, setRepeatDefault } from '../../lib/music/queue-actions.js';

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
        )
        .addStringOption((option) =>
          option
            .setName('repeat')
            .setDescription('The repeat mode a new session starts with')
            .addChoices(
              { name: 'off', value: 'off' },
              { name: 'track', value: 'track' },
              { name: 'queue', value: 'queue' },
            ),
        ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const mono = interaction.options.getString('mono');
    const autoplay = interaction.options.getString('autoplay');
    const repeat = interaction.options.getString('repeat') as 'off' | 'track' | 'queue' | null;
    if (!mono && !autoplay && !repeat) {
      const options = getPlaybackOptions();
      await replyNotice(interaction, {
        ok: true,
        message: `Mono: ${onOff(options.mono)} · Autoplay: ${onOff(options.autoplay)} · Repeat for new sessions: ${options.repeatDefault} · Volume: ${options.volume}`,
      });
      return;
    }

    const results = [
      ...(mono ? [setMono(mono === 'on')] : []),
      ...(autoplay ? [setAutoplay(autoplay === 'on')] : []),
      ...(repeat ? [setRepeatDefault(repeat)] : []),
    ];
    await replyNotice(interaction, {
      ok: results.every((result) => result.ok),
      message: results.map((result) => result.message).join(' '),
    });
    requestBannerRefresh();
  }
}
