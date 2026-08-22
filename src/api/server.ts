import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import type { EnvConfig } from '../lib/env.js';
import {
  getJob,
  listJobs,
  registerJob,
  resolveFailed,
  resolveReady,
  type TrackMeta,
} from './jobs/pending-registry.js';

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    throw new Error('Empty request body');
  }

  return JSON.parse(raw) as T;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function isAuthorized(req: IncomingMessage, token: string): boolean {
  const header = req.headers['x-pipit-internal-token'];
  if (typeof header !== 'string') {
    return false;
  }

  return header === token;
}

export function startApiServer(config: EnvConfig, logger: ApiLogger): void {
  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? 'GET';
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      if (method === 'GET' && url.pathname === '/api/health') {
        sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/music/jobs') {
        sendJson(res, 200, { jobs: listJobs() });
        return;
      }

      const getJobMatch = url.pathname.match(/^\/api\/music\/jobs\/([^/]+)$/);
      if (method === 'GET' && getJobMatch) {
        const jobId = decodeURIComponent(getJobMatch[1] ?? '');
        const job = getJob(jobId);
        if (!job) {
          sendJson(res, 404, { error: 'Job not found' });
          return;
        }

        sendJson(res, 200, job);
        return;
      }

      if (method === 'POST' && url.pathname === '/api/music/jobs') {
        const body = await readJson<{ jobId?: string; query?: string }>(req);
        if (!body.jobId || !body.query?.trim()) {
          sendJson(res, 400, { error: 'jobId and query are required' });
          return;
        }

        const job = registerJob(body.jobId, body.query.trim());
        sendJson(res, 201, job);
        return;
      }

      const readyMatch = url.pathname.match(/^\/internal\/music\/jobs\/([^/]+)\/ready$/);
      if (method === 'POST' && readyMatch) {
        if (!isAuthorized(req, config.internalToken)) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }

        const jobId = decodeURIComponent(readyMatch[1] ?? '');
        const body = await readJson<{ track?: TrackMeta }>(req);
        if (!body.track?.file) {
          sendJson(res, 400, { error: 'track.file is required' });
          return;
        }

        const job = resolveReady(jobId, body.track);
        sendJson(res, 200, job);
        return;
      }

      const failedMatch = url.pathname.match(/^\/internal\/music\/jobs\/([^/]+)\/failed$/);
      if (method === 'POST' && failedMatch) {
        if (!isAuthorized(req, config.internalToken)) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }

        const jobId = decodeURIComponent(failedMatch[1] ?? '');
        const body = await readJson<{ error?: string }>(req);
        const job = resolveFailed(jobId, body.error ?? 'Job failed');
        sendJson(res, 200, job);
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      logger.error('API handler error:', error);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  });

  server.listen(config.apiPort, () => {
    logger.info(`pipit-api listening on port ${config.apiPort}`);
  });
}

export interface ApiLogger {
  info(message: string): void;
  error(message: unknown, ...rest: unknown[]): void;
}
