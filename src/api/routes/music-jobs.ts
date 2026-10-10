import type { Hono } from 'hono';

import { canEnqueuePlayback } from '../../lib/music/playback.js';
import {
  retryMusicJob,
  schedulePlayWhenReady,
  submitMusicJob,
} from '../../lib/music/prepare-track.js';
import { dashboardViewer } from '../auth/dashboard.js';
import { internalAuth } from '../auth/internal.js';
import type { ApiVariables } from '../context.js';
import {
  cancelJob,
  getJob,
  listJobs,
  resolveFailed,
  resolveReady,
  type TrackMeta,
} from '../jobs/pending-registry.js';

/** The music jobs: the dashboard's list and actions, and the worker's callbacks. */
export function mountMusicJobRoutes(app: Hono<{ Variables: ApiVariables }>): void {
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
      const job = await submitMusicJob(body.jobId, body.query.trim(), {
        origin: 'dashboard',
        next: body.next,
      });
      schedulePlayWhenReady(body.jobId, { next: body.next });
      return c.json(job, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enqueue job';
      resolveFailed(body.jobId, message);
      return c.json({ error: message }, 503);
    }
  });

  app.post('/api/music/jobs/:jobId/cancel', dashboardViewer, (c) => {
    const job = cancelJob(c.req.param('jobId'));
    if (!job) {
      return c.json({ error: 'Job not found' }, 404);
    }

    if (job.status !== 'cancelled') {
      return c.json({ error: 'Only a job that is still being prepared can be cancelled.' }, 409);
    }

    return c.json(job);
  });

  app.post('/api/music/jobs/:jobId/retry', dashboardViewer, async (c) => {
    const original = getJob(c.req.param('jobId'));
    if (!original) {
      return c.json({ error: 'Job not found' }, 404);
    }

    if (original.status !== 'failed' && original.status !== 'cancelled') {
      return c.json({ error: 'Only a failed or cancelled job can be retried.' }, 409);
    }

    if (!canEnqueuePlayback()) {
      return c.json({ error: 'Bot is not in a voice channel.' }, 400);
    }

    try {
      return c.json(await retryMusicJob(original), 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enqueue job';
      const retryId = getJob(original.jobId)?.retriedAs;
      if (retryId) {
        resolveFailed(retryId, message);
      }
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
