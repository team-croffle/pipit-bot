import { existsSync } from 'node:fs';
import { join, normalize, relative } from 'node:path';

import { rootDir } from '../../lib/constants.js';
import { sendFile, sendJson } from '../http.js';
import type { RouteHandler } from '../types.js';

const distRoot = join(rootDir, 'dashboard', 'dist');

function isApiPath(pathname: string): boolean {
  return (
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname === '/internal' ||
    pathname.startsWith('/internal/')
  );
}

function looksLikeAsset(pathname: string): boolean {
  const name = pathname.split('/').at(-1) ?? '';
  return name.includes('.') && !name.endsWith('.html');
}

function resolveUnderDist(pathname: string): string | undefined {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const resolved = normalize(join(distRoot, relativePath));
  const rel = relative(distRoot, resolved);
  if (rel.startsWith('..') || rel === '..') {
    return undefined;
  }

  return resolved;
}

export const handleDashboardStatic: RouteHandler = async ({ method, url, res }) => {
  if (method !== 'GET') {
    return false;
  }

  if (isApiPath(url.pathname)) {
    return false;
  }

  if (!existsSync(distRoot)) {
    if (looksLikeAsset(url.pathname)) {
      return false;
    }

    sendJson(res, 503, { error: 'Dashboard is not built. Run yarn dashboard:build.' });
    return true;
  }

  const filePath = resolveUnderDist(url.pathname);
  if (filePath && (await sendFile(res, filePath))) {
    return true;
  }

  if (looksLikeAsset(url.pathname)) {
    return false;
  }

  if (await sendFile(res, join(distRoot, 'index.html'))) {
    return true;
  }

  sendJson(res, 503, { error: 'Dashboard is not built. Run yarn dashboard:build.' });
  return true;
};
