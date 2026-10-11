import { useMainPlayer } from 'discord-player';
import type { GuildMember, GuildTextBasedChannel } from 'discord.js';

import type { Notice } from '../discord/notice.js';
import { toLocalPlayQuery } from './local-file-extractor.js';
import { PLAYER_NODE_OPTIONS } from './player-node-options.js';
import { insertNextIfPlaying, prepareTrack } from './prepare-track.js';
import { connectPlayerToChannel } from './voice-connection.js';

/**
 * A track asked for from Discord — `/play`, the remote's play dialog, or a line typed
 * into the music channel. All three end here so they answer alike.
 *
 * The query is passed on untouched (AGENTS.md §2): the bot never reads it.
 */
export interface PlayRequest {
  query: string;
  next: boolean;
  member: GuildMember;
  /** Where the session's own notices go (a skipped track, for instance). */
  channel: GuildTextBasedChannel | null;
}

export async function requestPlay(request: PlayRequest): Promise<Notice> {
  const query = request.query.trim();
  if (!query) {
    return { ok: false, message: 'Type a song title or a link to play.' };
  }

  const voiceChannel = request.member.voice.channel;
  if (!voiceChannel) {
    return { ok: false, message: 'Join a voice channel first.' };
  }

  try {
    await connectPlayerToChannel(voiceChannel);
    const prepared = await prepareTrack(query, { next: request.next });

    if (request.next) {
      const inserted = await insertNextIfPlaying(
        voiceChannel.guild.id,
        prepared.file,
        request.member.id,
      );
      if (inserted) {
        return { ok: true, message: `${inserted.title} will play next.` };
      }
    }

    const player = useMainPlayer();
    const { track, queue } = await player.play(
      voiceChannel as unknown as Parameters<typeof player.play>[0],
      toLocalPlayQuery(prepared.file),
      {
        requestedBy: request.member.id,
        nodeOptions: { ...PLAYER_NODE_OPTIONS, metadata: { channel: request.channel } },
      },
    );

    return queue.isPlaying() && queue.tracks.size > 0
      ? { ok: true, message: `Added ${track.title} to the queue (position ${queue.tracks.size}).` }
      : { ok: true, message: `Now playing: ${track.title}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not play that.',
    };
  }
}
