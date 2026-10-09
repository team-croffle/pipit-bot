import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { skipToQueuedTrack } from '../../lib/music/queue-actions.js';

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

    const result = skipToQueuedTrack({ index: idx }, guildId);
    return result.ok ? `Skipped to: **${result.title}**` : result.message;
  }
}
