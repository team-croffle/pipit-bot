import { getDashboardIdentity } from '../auth/dashboard.js';
import { sendJson } from '../http.js';
import type { RouteHandler } from '../types.js';

export const handleMe: RouteHandler = ({ method, url, req, res, config }) => {
  if (method !== 'GET' || url.pathname !== '/api/me') {
    return false;
  }

  sendJson(res, 200, getDashboardIdentity(req, config));
  return true;
};
