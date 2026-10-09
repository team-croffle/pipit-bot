import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { removeQueuedTrack } from '../../lib/music/queue-actions.js';

@ApplyOptions<Command.Options>({
  description: 'Remove a track from the queue by 1-based index',
  aliases: ['remove', 'rm'],
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message, args: Args): Promise<void> {
    const result = await this.doDelete(message.guildId, args);

    if (message.channel.isSendable()) {
      await message.channel.send(result);
    }
  }

  private async doDelete(guildId: string | null, args: Args): Promise<string> {
    if (!guildId) {
      return 'No guild ID provided';
    }

    const idx = await args.pick('integer').catch(() => null);
    if (idx === null) {
      return 'Please provide a valid track index to remove.';
    }

    const result = removeQueuedTrack({ index: idx }, guildId);
    return result.ok ? `Removed **${result.title}** from the queue.` : result.message;
  }
}
