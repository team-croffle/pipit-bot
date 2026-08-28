import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command } from '@sapphire/framework';
import { useQueue } from 'discord-player';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
  description: 'Skip to a track in the queue by 1-based index',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message, args: Args): Promise<void> {
    const result = await this.doSkipTo(message.guildId, args);

    if (message.channel.isSendable()) {
      await message.channel.send(result);
    }
  }

  private async doSkipTo(guildId: string | null, args: Args): Promise<string> {
    if (!guildId) {
      return 'No guild ID provided';
    }

    const idx = await args.pick('integer').catch(() => null);
    if (idx === null) {
      return 'Please provide a valid track index to skip to.';
    }

    const queue = useQueue(guildId);
    if (!queue) {
      return 'No active music session found in this server.';
    }

    const track = queue.tracks.find((_, i) => i === idx - 1);
    if (!track) {
      return `No track found at index ${idx}.`;
    }

    if (queue.node.skipTo(idx - 1)) {
      return `Skipped to: **${track.title}**`;
    }

    return 'Failed to skip to that track.';
  }
}
