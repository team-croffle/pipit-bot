import type { Hono } from 'hono';

import { getConfiguredGuild } from '../../lib/discord-guild.js';
import {
  canEnqueuePlayback,
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
import { schedulePlayWhenReady, submitMusicJob } from '../../lib/music/prepare-track.js';
import {
  removeQueuedTrack,
  setVolumeLevel,
  skipToQueuedTrack,
} from '../../lib/music/queue-actions.js';
import { joinVoiceChannel, leaveVoiceChannel } from '../../lib/music/voice-connection.js';
import { isVolumeLevel } from '../../lib/music/volume-levels.js';
import { dashboardViewer } from '../auth/dashboard.js';
import { internalAuth } from '../auth/internal.js';
import type { ApiVariables } from '../context.js';
import {
  getJob,
  listJobs,
  resolveFailed,
  resolveReady,
  type TrackMeta,
} from '../jobs/pending-registry.js';

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

  app.post('/api/music/playback/volume', dashboardViewer, async (c) => {
    const body = await c.req.json<{ level?: unknown }>();
    if (!isVolumeLevel(body.level)) {
      return c.json({ error: 'level must be low, mid, or high' }, 400);
    }

    const result = setVolumeLevel(body.level);
    return c.json(result, result.ok ? 200 : 400);
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

  app.get('/api/music/jobs', dashboardViewer, (c) => c.json({ jobs: listJobs() }));

  app.get('/api/music/jobs/:jobId', dashboardViewer, (c) => {
    const job = getJob(c.req.param('jobId'));
    if (!job) {
      return c.json({ error: 'Job not found' }, 404);
    }

    return c.json(job);
  });

  app.post('/api/music/jobs', dashboardViewer, async (c) => {
    const body = await c.req.json<{ jobId?: string; query?: string; next?: unknown }>();
    if (!body.jobId || !body.query?.trim()) {
      return c.json({ error: 'jobId and query are required' }, 400);
    }

    if (body.next !== undefined && typeof body.next !== 'boolean') {
      return c.json({ error: 'next must be a boolean' }, 400);
    }

    if (!canEnqueuePlayback()) {
      return c.json({ error: 'Bot is not in a voice channel.' }, 400);
    }

    try {
      const job = await submitMusicJob(body.jobId, body.query.trim());
      schedulePlayWhenReady(body.jobId, { next: body.next });
      return c.json(job, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enqueue job';
      resolveFailed(body.jobId, message);
      return c.json({ error: message }, 503);
    }
  });

  app.post('/internal/music/jobs/:jobId/ready', internalAuth, async (c) => {
    const body = await c.req.json<{ track?: TrackMeta }>();
    if (!body.track?.file) {
      return c.json({ error: 'track.file is required' }, 400);
    }

    const job = resolveReady(c.req.param('jobId'), body.track);
    return c.json(job);
  });

  app.post('/internal/music/jobs/:jobId/failed', internalAuth, async (c) => {
    const body = await c.req.json<{ error?: string }>();
    const job = resolveFailed(c.req.param('jobId'), body.error ?? 'Job failed');
    return c.json(job);
  });
}
