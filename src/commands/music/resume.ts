import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { useQueue } from 'discord-player';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
  description: 'Resume the paused track',
  aliases: ['unpause'],
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message): Promise<void> {
    const result = this.doResume(message);

    if (message.channel.isSendable()) {
      await message.channel.send(result);
    }
  }

  private doResume(message: Message): string {
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
    const currentTrack = queue?.currentTrack;
    if (!queue || !currentTrack) {
      return 'No track is currently playing.';
    }

    if (!queue.node.isPaused()) {
      return 'The music is not paused.';
    }

    if (queue.node.resume()) {
      return `Resumed: **${currentTrack.title}**`;
    }

    return 'Failed to resume the track.';
  }
}
