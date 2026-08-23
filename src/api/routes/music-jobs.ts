import { requireDashboardViewer, requirePlaybackControl } from '../auth/dashboard.js';
import { readJson, sendJson } from '../http.js';
import { getJob, listJobs, registerJob } from '../jobs/pending-registry.js';
import type { RouteHandler } from '../types.js';

export const handleMusicJobs: RouteHandler = async ({ method, url, req, res, config }) => {
  if (method === 'GET' && url.pathname === '/api/music/jobs') {
    if (!requireDashboardViewer(req, res, config)) {
      return true;
    }

    sendJson(res, 200, { jobs: listJobs() });
    return true;
  }

  const getJobMatch = url.pathname.match(/^\/api\/music\/jobs\/([^/]+)$/);
  if (method === 'GET' && getJobMatch) {
    if (!requireDashboardViewer(req, res, config)) {
      return true;
    }

    const jobId = decodeURIComponent(getJobMatch[1] ?? '');
    const job = getJob(jobId);
    if (!job) {
      sendJson(res, 404, { error: 'Job not found' });
      return true;
    }

    sendJson(res, 200, job);
    return true;
  }

  if (method === 'POST' && url.pathname === '/api/music/jobs') {
    if (!requirePlaybackControl(req, res, config)) {
      return true;
    }

    const body = await readJson<{ jobId?: string; query?: string }>(req);
    if (!body.jobId || !body.query?.trim()) {
      sendJson(res, 400, { error: 'jobId and query are required' });
      return true;
    }

    const job = registerJob(body.jobId, body.query.trim());
    sendJson(res, 201, job);
    return true;
  }

  return false;
};
