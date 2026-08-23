import { sendJson } from '../http.js';
import type { RouteHandler } from '../types.js';

export const handleHealth: RouteHandler = ({ method, url, res }) => {
  if (method !== 'GET' || url.pathname !== '/api/health') {
    return false;
  }

  sendJson(res, 200, { status: 'ok' });
  return true;
};
