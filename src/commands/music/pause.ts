import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { useQueue } from 'discord-player';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
  description: 'Pause the currently playing track',
  preconditions: ['MainOnly', 'MusicChannel'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message): Promise<void> {
    const result = this.doPause(message);

    if (message.channel.isSendable()) {
      await message.channel.send(result);
    }
  }

  private doPause(message: Message): string {
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

    if (queue.node.isPaused()) {
      return 'The music is already paused.';
    }

    if (queue.node.pause()) {
      return `Paused: **${currentTrack.title}**`;
    }

    return 'Failed to pause the track.';
  }
}
