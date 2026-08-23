import { requireDashboardViewer } from '../auth/dashboard.js';
import { sendJson } from '../http.js';
import type { RouteHandler } from '../types.js';

export const handleMe: RouteHandler = ({ method, url, req, res, config }) => {
  if (method !== 'GET' || url.pathname !== '/api/me') {
    return false;
  }

  const identity = requireDashboardViewer(req, res, config);
  if (!identity) {
    return true;
  }

  sendJson(res, 200, identity);
  return true;
};
