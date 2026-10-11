import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { playPrevious } from '../../lib/music/history.js';

@ApplyOptions<Command.Options>({
  description: 'Go back to the previous track; the current one returns to the front of the queue',
  aliases: ['prev', '이전'],
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message): Promise<void> {
    const result = message.guildId
      ? (await playPrevious(message.guildId)).message
      : 'No guild ID provided';

    if (message.channel.isSendable()) {
      await message.channel.send(result);
    }
  }
}
