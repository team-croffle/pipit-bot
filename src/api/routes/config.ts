import { getRuntimeConfig, updateRuntimeConfig } from '../../lib/runtime-config.js';
import { requireDashboardViewer, requireDashboardWrite } from '../auth/dashboard.js';
import { readJson, sendJson } from '../http.js';
import type { RouteHandler } from '../types.js';

export const handleConfig: RouteHandler = async ({ method, url, req, res, config }) => {
  if (url.pathname !== '/api/config') {
    return false;
  }

  if (method === 'GET') {
    if (!requireDashboardViewer(req, res, config)) {
      return true;
    }

    sendJson(res, 200, { ...getRuntimeConfig(), role: config.role });
    return true;
  }

  if (method === 'PUT') {
    if (!requireDashboardWrite(req, res, config)) {
      return true;
    }

    const body = await readJson<{
      prefix?: string;
      commandChannelId?: string | null;
    }>(req);

    if (body.prefix !== undefined && !body.prefix.trim()) {
      sendJson(res, 400, { error: 'prefix must not be empty' });
      return true;
    }

    const updated = updateRuntimeConfig(body);
    sendJson(res, 200, updated);
    return true;
  }

  return false;
};
