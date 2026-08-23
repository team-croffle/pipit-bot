import { getVoiceConnection, useMainPlayer, useQueue } from 'discord-player';
import type { Guild, VoiceBasedChannel } from 'discord.js';

import { getConfiguredGuild } from '../discord-guild.js';
import { PLAYER_NODE_OPTIONS } from './player-node-options.js';

/** discord-player uses the bot user id as the voice connection group; !join used "default". */
export function destroyLegacyVoiceConnection(guildId: string): void {
  const legacy = getVoiceConnection(guildId);
  if (legacy) {
    legacy.destroy();
  }
}

export async function connectPlayerToChannel(voiceChannel: VoiceBasedChannel): Promise<void> {
  destroyLegacyVoiceConnection(voiceChannel.guild.id);

  const player = useMainPlayer();
  let queue = useQueue(voiceChannel.guild.id);
  if (!queue) {
    queue = player.nodes.create(voiceChannel.guild.id, PLAYER_NODE_OPTIONS);
  }

  if (!queue.channel) {
    await queue.connect(voiceChannel as unknown as Parameters<typeof queue.connect>[0]);
  }
}

export async function ensureBotVoiceChannel(): Promise<{
  guild: Guild;
  voiceChannel: VoiceBasedChannel;
}> {
  const guild = getConfiguredGuild();
  if (!guild) {
    throw new Error('Discord guild is not ready.');
  }

  const voiceChannel = guild.members.me?.voice.channel;
  if (!voiceChannel) {
    throw new Error('Bot is not in a voice channel. Join a voice channel with the bot first.');
  }

  await connectPlayerToChannel(voiceChannel);
  return { guild, voiceChannel };
}
