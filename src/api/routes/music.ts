import type { Hono } from 'hono';

import { getConfiguredGuild } from '../../lib/discord-guild.js';
import { getRecentTracks, playPrevious } from '../../lib/music/history.js';
import {
  clearQueue,
  getPlaybackState,
  pausePlayback,
  resumePlayback,
  setLoopMode,
  skipPlayback,
  stopPlayback,
  type LoopMode,
} from '../../lib/music/playback.js';
import { PLAYER_NODE_OPTIONS } from '../../lib/music/player-node-options.js';
import {
  moveQueuedTrack,
  removeQueuedTrack,
  setAutoplay,
  setMono,
  setVolume,
  shuffleQueue,
  skipToQueuedTrack,
} from '../../lib/music/queue-actions.js';
import { joinVoiceChannel, leaveVoiceChannel } from '../../lib/music/voice-connection.js';
import { volumeFrom } from '../../lib/music/volume.js';
import { dashboardViewer } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

export function mountMusicRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  app.get('/api/music/playback', dashboardViewer, (c) => c.json(getPlaybackState()));

  app.post('/api/music/playback/pause', dashboardViewer, (c) => {
    const result = pausePlayback();
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/resume', dashboardViewer, (c) => {
    const result = resumePlayback();
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/skip', dashboardViewer, (c) => {
    const result = skipPlayback();
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/stop', dashboardViewer, (c) => {
    const result = stopPlayback();
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/clear', dashboardViewer, (c) => {
    const result = clearQueue();
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/loop', dashboardViewer, async (c) => {
    const body = await c.req.json<{ mode?: string }>();
    const mode = body.mode;
    if (mode !== 'track' && mode !== 'queue' && mode !== 'off') {
      return c.json({ error: 'mode must be track, queue, or off' }, 400);
    }

    const result = setLoopMode(mode as LoopMode);
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/remove', dashboardViewer, async (c) => {
    const body = await c.req.json<{ trackId?: unknown }>();
    if (typeof body.trackId !== 'string' || !body.trackId) {
      return c.json({ error: 'trackId is required' }, 400);
    }

    const result = removeQueuedTrack({ id: body.trackId });
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/skipto', dashboardViewer, async (c) => {
    const body = await c.req.json<{ trackId?: unknown }>();
    if (typeof body.trackId !== 'string' || !body.trackId) {
      return c.json({ error: 'trackId is required' }, 400);
    }

    const result = skipToQueuedTrack({ id: body.trackId });
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/move', dashboardViewer, async (c) => {
    const body = await c.req.json<{ trackId?: unknown; to?: unknown }>();
    if (typeof body.trackId !== 'string' || !body.trackId || typeof body.to !== 'number') {
      return c.json({ error: 'trackId and to are required' }, 400);
    }

    const result = moveQueuedTrack({ id: body.trackId }, body.to);
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/shuffle', dashboardViewer, (c) => {
    const result = shuffleQueue();
    return c.json(result, result.ok ? 200 : 400);
  });

  app.get('/api/music/playback/history', dashboardViewer, (c) =>
    c.json({ tracks: getRecentTracks() }),
  );

  app.post('/api/music/playback/back', dashboardViewer, async (c) => {
    const result = await playPrevious();
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/volume', dashboardViewer, async (c) => {
    // `level` is what a dashboard from before v0.7.5-rc.3 still sends.
    const body = await c.req.json<{ volume?: unknown; level?: unknown }>();
    const volume = volumeFrom(body.volume ?? body.level);
    if (volume === null) {
      return c.json({ error: 'volume must be a whole number from 0 to 200' }, 400);
    }

    const result = setVolume(volume);
    return c.json(result, result.ok ? 200 : 400);
  });

  app.post('/api/music/playback/options', dashboardViewer, async (c) => {
    const body = await c.req.json<{ mono?: unknown; autoplay?: unknown }>();
    if (typeof body.mono === 'boolean') {
      return c.json(setMono(body.mono));
    }
    if (typeof body.autoplay === 'boolean') {
      const result = setAutoplay(body.autoplay);
      return c.json(result, result.ok ? 200 : 400);
    }

    return c.json({ error: 'mono or autoplay must be true or false' }, 400);
  });

  app.post('/api/music/voice/join', dashboardViewer, async (c) => {
    const body = await c.req.json<{ channelId?: unknown }>();
    if (typeof body.channelId !== 'string' || !body.channelId) {
      return c.json({ error: 'channelId is required' }, 400);
    }

    const guild = getConfiguredGuild();
    if (!guild) {
      return c.json({ error: 'Discord guild is not ready.' }, 503);
    }

    const channel = guild.channels.cache.get(body.channelId);
    if (!channel?.isVoiceBased()) {
      return c.json({ ok: false, message: 'That is not a voice channel in this server.' }, 400);
    }

    const me = guild.members.me;
    if (me && !channel.permissionsFor(me).has(['ViewChannel', 'Connect', 'Speak'])) {
      return c.json(
        { ok: false, message: `The bot cannot connect and speak in ${channel.name}.` },
        400,
      );
    }

    try {
      const result = await joinVoiceChannel(channel);
      // The player leaves an empty channel on its own after the cooldown; say so now
      // rather than have the bot vanish half a minute later with no explanation.
      const empty = channel.members.every((member) => member.user.bot);
      const seconds = Math.round(PLAYER_NODE_OPTIONS.leaveOnEmptyCooldown / 1000);
      const message =
        result.ok && empty
          ? `${result.message} Nobody is there, so the bot leaves after ${seconds} seconds.`
          : result.message;
      return c.json({ ...result, message }, result.ok ? 200 : 400);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join the voice channel.';
      return c.json({ ok: false, message }, 503);
    }
  });

  app.post('/api/music/voice/leave', dashboardViewer, (c) => {
    const guild = getConfiguredGuild();
    if (!guild) {
      return c.json({ error: 'Discord guild is not ready.' }, 503);
    }

    const result = leaveVoiceChannel(guild.id);
    return c.json(result, result.ok ? 200 : 400);
  });
}
