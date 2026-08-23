import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command } from '@sapphire/framework';
import { useMainPlayer, useQueue } from 'discord-player';
import type { Message } from 'discord.js';

import { toLocalPlayQuery } from '../../lib/music/local-file-extractor.js';
import { PLAYER_NODE_OPTIONS } from '../../lib/music/player-node-options.js';
import { prepareTrack } from '../../lib/music/prepare-track.js';
import { connectPlayerToChannel } from '../../lib/music/voice-connection.js';

@ApplyOptions<Command.Options>({
  description: 'Play a track next (priority reservation)',
  aliases: ['pn'],
  preconditions: ['MainOnly', 'MusicChannel'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message, args: Args) {
    const { member, guild } = message;

    if (!guild) {
      return message.reply('This command can only be used in a server.');
    }

    if (!message.channel.isSendable()) {
      return;
    }

    const voiceChannel = member?.voice.channel;
    if (!voiceChannel) {
      return message.reply('You need to be in a voice channel to use this command.');
    }

    const query = await args.rest('string').catch(() => null);
    if (!query?.trim()) {
      return message.reply('Provide something to play next.\nExample: `!playnext <query>`');
    }

    const player = useMainPlayer();
    const queue = useQueue(guild.id);

    try {
      const feedbackMessage = await message.channel.send(`Preparing \`${query.trim()}\`...`);

      await connectPlayerToChannel(voiceChannel);
      const trackMeta = await prepareTrack(query);
      const playQuery = toLocalPlayQuery(trackMeta.file);

      if (queue?.currentTrack) {
        const search = await player.search(playQuery);
        const track = search.tracks[0];
        if (!track) {
          return feedbackMessage.edit('No tracks were found for that query.');
        }

        queue.node.insert(track, 0);
        return feedbackMessage.edit(`\`${track.title}\` will play next.`);
      }

      const { track } = await player.play(
        voiceChannel as unknown as Parameters<typeof player.play>[0],
        playQuery,
        {
          nodeOptions: {
            ...PLAYER_NODE_OPTIONS,
            metadata: message,
          },
        },
      );

      return feedbackMessage.edit(`\`${track.title}\` is now playing!`);
    } catch (error) {
      this.container.logger.error('Error playing next track:', error);
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Unknown error';
      const content = `Error occurred while trying to play next: ${detail}`.slice(0, 1900);
      return message.channel.send(content);
    }
  }
}
