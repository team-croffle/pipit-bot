import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { leaveVoiceChannel } from '../../lib/music/voice-connection.js';

@ApplyOptions<Command.Options>({
  description: 'Leaves the voice channel and stops music playback',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message): Promise<void> {
    const result = this.doLeave(message.guildId);
    if (message.channel.isSendable()) {
      await message.channel.send(result);
    }
  }

  private doLeave(guildId: string | null): string {
    if (!guildId) {
      return 'No guild ID provided';
    }

    return leaveVoiceChannel(guildId).message;
  }
}
