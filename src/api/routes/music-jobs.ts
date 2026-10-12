import type { Hono } from 'hono';

import { readFailureCode } from '../../lib/music/failure-codes.js';
import { canEnqueuePlayback } from '../../lib/music/playback.js';
import {
  retryMusicJob,
  schedulePlayWhenReady,
  submitMusicJob,
} from '../../lib/music/prepare-track.js';
import { getCandidate, PICK_PROBLEM_MESSAGE } from '../../lib/music/search-results.js';
import { dashboardViewer } from '../auth/dashboard.js';
import { internalAuth } from '../auth/internal.js';
import type { ApiVariables } from '../context.js';
import {
  cancelJob,
  getJob,
  listJobs,
  publicJob,
  resolveFailed,
  resolveReady,
  type TrackMeta,
} from '../jobs/pending-registry.js';
import { dashboardOwner } from './music-search.js';

/** The music jobs: the dashboard's list and actions, and the worker's callbacks. */
export function mountMusicJobRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  app.get('/api/music/jobs', dashboardViewer, (c) => c.json({ jobs: listJobs().map(publicJob) }));

  app.get('/api/music/jobs/:jobId', dashboardViewer, (c) => {
    const job = getJob(c.req.param('jobId'));
    if (!job) {
      return c.json({ error: 'Job not found' }, 404);
    }

    return c.json(publicJob(job));
  });

  app.post('/api/music/jobs', dashboardViewer, async (c) => {
    const body = await c.req.json<{
      jobId?: string;
      query?: string;
      searchId?: string;
      index?: unknown;
      next?: unknown;
    }>();
    if (!body.jobId || (!body.query?.trim() && !body.searchId)) {
      return c.json({ error: 'jobId and either query or searchId are required' }, 400);
    }

    // A picked search result: the worker's value is looked up here and never sent back.
    let query = body.query?.trim() ?? '';
    let label: string | undefined;
    if (body.searchId) {
      const found = getCandidate(body.searchId, Number(body.index ?? -1), dashboardOwner(c));
      if ('problem' in found) {
        return c.json(
          { error: PICK_PROBLEM_MESSAGE[found.problem] },
          found.problem === 'not-yours' ? 403 : 410,
        );
      }
      query = found.candidate.query;
      label = found.candidate.title;
    }

    if (body.next !== undefined && typeof body.next !== 'boolean') {
      return c.json({ error: 'next must be a boolean' }, 400);
    }

    if (!canEnqueuePlayback()) {
      return c.json({ error: 'Bot is not in a voice channel.' }, 400);
    }

    try {
      const job = await submitMusicJob(body.jobId, query, {
        origin: 'dashboard',
        next: body.next,
        label,
      });
      schedulePlayWhenReady(body.jobId, { next: body.next });
      return c.json(publicJob(job), 201);
    } catch (error) {
      // submitMusicJob has already failed the job (code unavailable).
      const message = error instanceof Error ? error.message : 'Failed to enqueue job';
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

    return c.json(publicJob(job));
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
      return c.json(publicJob(await retryMusicJob(original)), 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enqueue job';
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
    const body = await c.req.json<{ error?: unknown; code?: unknown }>();
    const error =
      typeof body.error === 'string' && body.error ? body.error.slice(0, 500) : 'Job failed';
    const job = resolveFailed(c.req.param('jobId'), error, readFailureCode(body.code));
    return c.json(job);
  });
}
