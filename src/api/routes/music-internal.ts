import { isInternalAuthorized } from '../auth/internal.js';
import { readJson, sendJson } from '../http.js';
import { resolveFailed, resolveReady, type TrackMeta } from '../jobs/pending-registry.js';
import type { RouteHandler } from '../types.js';

export const handleMusicInternal: RouteHandler = async ({ method, url, req, res, config }) => {
  if (method !== 'POST') {
    return false;
  }

  const readyMatch = url.pathname.match(/^\/internal\/music\/jobs\/([^/]+)\/ready$/);
  if (readyMatch) {
    if (!isInternalAuthorized(req, config.internalToken)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    const jobId = decodeURIComponent(readyMatch[1] ?? '');
    const body = await readJson<{ track?: TrackMeta }>(req);
    if (!body.track?.file) {
      sendJson(res, 400, { error: 'track.file is required' });
      return true;
    }

    const job = resolveReady(jobId, body.track);
    sendJson(res, 200, job);
    return true;
  }

  const failedMatch = url.pathname.match(/^\/internal\/music\/jobs\/([^/]+)\/failed$/);
  if (failedMatch) {
    if (!isInternalAuthorized(req, config.internalToken)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    const jobId = decodeURIComponent(failedMatch[1] ?? '');
    const body = await readJson<{ error?: string }>(req);
    const job = resolveFailed(jobId, body.error ?? 'Job failed');
    sendJson(res, 200, job);
    return true;
  }

  return false;
};
