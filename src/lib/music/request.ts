import { useMainPlayer } from 'discord-player';
import type { GuildMember, GuildTextBasedChannel } from 'discord.js';

import type { Notice } from '../discord/notice.js';
import { say } from '../i18n/phrase.js';
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
  /** Shown as the request on the dashboard when the query is not the person's own words. */
  label?: string;
}

export async function requestPlay(request: PlayRequest): Promise<Notice> {
  const query = request.query.trim();
  if (!query) {
    return { ok: false, ...say('typeToPlay') };
  }

  const voiceChannel = request.member.voice.channel;
  if (!voiceChannel) {
    return { ok: false, ...say('joinVoiceFirst') };
  }

  try {
    await connectPlayerToChannel(voiceChannel);
    const prepared = await prepareTrack(query, { next: request.next, label: request.label });

    if (request.next) {
      const inserted = await insertNextIfPlaying(
        voiceChannel.guild.id,
        prepared.file,
        request.member.id,
      );
      if (inserted) {
        return { ok: true, ...say('playsNext', { title: inserted.title }) };
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
      ? {
          ok: true,
          ...say('addedToQueue', { title: track.title, position: queue.tracks.size }),
        }
      : { ok: true, ...say('nowPlaying', { title: track.title }) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not play that.',
    };
  }
}
