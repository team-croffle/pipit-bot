import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command } from '@sapphire/framework';
import { QueueRepeatMode, useQueue } from 'discord-player';
import type { Message } from 'discord.js';

const VALID_MODES = ['track', 'queue', 'off'] as const;
type LoopMode = (typeof VALID_MODES)[number];

@ApplyOptions<Command.Options>({
  description: 'Set repeat mode: track, queue, or off',
  aliases: ['repeat', '반복'],
  preconditions: ['MainOnly', 'MusicChannel'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message, args: Args): Promise<void> {
    const result = await this.doLoop(message.guildId, args);

    if (message.channel.isSendable()) {
      await message.channel.send(result);
    }
  }

  private async doLoop(guildId: string | null, args: Args): Promise<string> {
    if (!guildId) {
      return 'No guild ID provided';
    }

    const queue = useQueue(guildId);
    if (!queue) {
      return 'No active music session found in this server.';
    }

    const input = await args.pick('string').catch(() => null);

    if (!input) {
      const current = this.formatRepeatMode(queue.repeatMode);
      const track = queue.currentTrack;
      const trackInfo = track ? ` (현재: **${track.title}**)` : '';
      return `Current repeat mode: **${current}**${trackInfo}\nUsage: \`!loop track\` / \`!loop queue\` / \`!loop off\``;
    }

    const mode = input.toLowerCase() as LoopMode;
    if (!VALID_MODES.includes(mode)) {
      return `Invalid mode. Use: \`!loop track\` / \`!loop queue\` / \`!loop off\``;
    }

    switch (mode) {
      case 'track':
        queue.setRepeatMode(QueueRepeatMode.TRACK);
        return '🔂 Repeat mode set to **track**.';
      case 'queue':
        queue.setRepeatMode(QueueRepeatMode.QUEUE);
        return '🔁 Repeat mode set to **queue**.';
      case 'off':
        queue.setRepeatMode(QueueRepeatMode.OFF);
        return '➡️ Repeat mode **off**.';
    }
  }

  private formatRepeatMode(mode: QueueRepeatMode): string {
    switch (mode) {
      case QueueRepeatMode.TRACK:
        return 'track 🔂';
      case QueueRepeatMode.QUEUE:
        return 'queue 🔁';
      default:
        return 'off ➡️';
    }
  }
}
