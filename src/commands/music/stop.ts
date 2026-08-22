import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { useQueue } from 'discord-player';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
  description: 'Stop playback and clear the queue',
  preconditions: ['MainOnly', 'CommandChannel'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message): Promise<void> {
    const result = this.doStop(message);

    if (message.channel.isSendable()) {
      await message.channel.send(result);
    }
  }

  private doStop(message: Message): string {
    if (!message.guildId) {
      return 'No guild ID provided';
    }

    const memberVoiceChannelId = message.member?.voice.channelId;
    if (!memberVoiceChannelId) {
      return 'Join a voice channel first.';
    }

    const botVoiceChannelId = message.guild?.members.me?.voice.channelId;
    if (botVoiceChannelId && botVoiceChannelId !== memberVoiceChannelId) {
      return 'I am in a different voice channel. Join the same channel first.';
    }

    const queue = useQueue(message.guildId);
    if (!queue) {
      return 'No active music session found in this server.';
    }

    if (queue.node.stop()) {
      return 'Stopped playback and cleared the queue.';
    }

    return 'Failed to stop playback.';
  }
}
