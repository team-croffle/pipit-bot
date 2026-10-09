import { getVoiceConnection, useMainPlayer, useQueue } from 'discord-player';
import type { Guild, VoiceBasedChannel } from 'discord.js';

import { getConfiguredGuild } from '../discord-guild.js';
import type { PlaybackActionResult } from './playback.js';
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

/**
 * Joins `voiceChannel`, or moves there when the bot is already in another one.
 *
 * WHY a move goes through `rejoin` rather than `queue.connect`: connecting a queue to a
 * different channel destroys its dispatcher, which stops the track mid-play. Rejoining
 * keeps the same voice connection and audio player, so playback carries on; the
 * player's voice-state handler then points the queue at the new channel.
 */
export async function joinVoiceChannel(
  voiceChannel: VoiceBasedChannel,
): Promise<PlaybackActionResult> {
  const queue = useQueue(voiceChannel.guild.id);
  const connection = queue?.connection;

  if (queue?.channel && connection) {
    if (queue.channel.id === voiceChannel.id) {
      return { ok: false, message: `Already in ${voiceChannel.name}.` };
    }

    const moved = connection.rejoin({
      channelId: voiceChannel.id,
      selfDeaf: queue.options.selfDeaf ?? true,
      selfMute: false,
    });
    return moved
      ? { ok: true, message: `Moved to ${voiceChannel.name}.` }
      : { ok: false, message: `Could not move to ${voiceChannel.name}.` };
  }

  await connectPlayerToChannel(voiceChannel);
  return { ok: true, message: `Joined ${voiceChannel.name}.` };
}

export function leaveVoiceChannel(guildId: string): PlaybackActionResult {
  const queue = useQueue(guildId);
  const connection = getVoiceConnection(guildId);

  if (!queue && !connection) {
    return { ok: false, message: 'No active music session found in this server.' };
  }

  if (queue) {
    queue.delete();
  } else {
    connection?.destroy();
  }

  return { ok: true, message: 'Left the voice channel successfully.' };
}
