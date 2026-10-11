import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { shuffleQueue } from '../../lib/music/queue-actions.js';

@ApplyOptions<Command.Options>({
  description: 'Shuffle the queued tracks once',
  aliases: ['섞기'],
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message): Promise<void> {
    const result = message.guildId ? shuffleQueue(message.guildId).message : 'No guild ID provided';

    if (message.channel.isSendable()) {
      await message.channel.send(result);
    }
  }
}
