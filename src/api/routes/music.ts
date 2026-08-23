import type { Hono } from 'hono';

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
import { schedulePlayWhenReady, submitMusicJob } from '../../lib/music/prepare-track.js';
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

  app.get('/api/music/jobs', dashboardViewer, (c) => c.json({ jobs: listJobs() }));

  app.get('/api/music/jobs/:jobId', dashboardViewer, (c) => {
    const job = getJob(c.req.param('jobId'));
    if (!job) {
      return c.json({ error: 'Job not found' }, 404);
    }

    return c.json(job);
  });

  app.post('/api/music/jobs', dashboardViewer, async (c) => {
    const body = await c.req.json<{ jobId?: string; query?: string }>();
    if (!body.jobId || !body.query?.trim()) {
      return c.json({ error: 'jobId and query are required' }, 400);
    }

    if (!canEnqueuePlayback()) {
      return c.json({ error: 'Bot is not in a voice channel.' }, 400);
    }

    try {
      const job = await submitMusicJob(body.jobId, body.query.trim());
      schedulePlayWhenReady(body.jobId);
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
