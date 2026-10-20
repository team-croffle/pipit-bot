import { createMiddleware } from 'hono/factory';

import { audit } from '../lib/audit/log.js';
import type { AuditCategory, AuditOutcome } from '../lib/audit/types.js';
import type { DashboardIdentity } from './auth/dashboard.js';
import type { AuditNote } from './context.js';

interface ActionRule {
  method: string;
  pattern: RegExp;
  /** `$1` is replaced with the first capture. */
  action: string;
  /** Which capture, if any, names the target. */
  target?: number;
}

const RULES: ActionRule[] = [
  { method: 'PUT', pattern: /^\/api\/config$/, action: 'settings.update' },
  { method: 'PUT', pattern: /^\/api\/settings\/features$/, action: 'features.update' },
  { method: 'PUT', pattern: /^\/api\/guild-events$/, action: 'member-events.update' },
  { method: 'PUT', pattern: /^\/api\/github-notify$/, action: 'github-notify.update' },
  { method: 'POST', pattern: /^\/api\/github-notify\/remind$/, action: 'github.remind' },
  { method: 'PUT', pattern: /^\/api\/reaction-roles$/, action: 'reaction-roles.update' },
  {
    method: 'POST',
    pattern: /^\/api\/reaction-roles\/([^/]+)\/publish$/,
    action: 'reaction-roles.publish',
    target: 1,
  },
  { method: 'POST', pattern: /^\/api\/music\/playback\/([a-z]+)$/, action: 'music.$1' },
  { method: 'POST', pattern: /^\/api\/music\/voice\/(join|leave)$/, action: 'music.$1' },
  { method: 'POST', pattern: /^\/api\/music\/jobs$/, action: 'music.enqueue' },
  { method: 'POST', pattern: /^\/api\/music\/search$/, action: 'music.search' },
  { method: 'POST', pattern: /^\/api\/playlists$/, action: 'playlist.create' },
  { method: 'POST', pattern: /^\/api\/playlists\/import$/, action: 'playlist.import' },
  { method: 'PATCH', pattern: /^\/api\/playlists\/([^/]+)$/, action: 'playlist.rename', target: 1 },
  {
    method: 'DELETE',
    pattern: /^\/api\/playlists\/([^/]+)$/,
    action: 'playlist.delete',
    target: 1,
  },
  {
    method: 'POST',
    pattern: /^\/api\/playlists\/([^/]+)\/items$/,
    action: 'playlist.add',
    target: 1,
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/playlists\/([^/]+)\/items\/[^/]+$/,
    action: 'playlist.remove',
    target: 1,
  },
  {
    method: 'POST',
    pattern: /^\/api\/playlists\/([^/]+)\/items\/[^/]+\/move$/,
    action: 'playlist.move',
    target: 1,
  },
  {
    method: 'POST',
    pattern: /^\/api\/playlists\/([^/]+)\/play$/,
    action: 'playlist.play',
    target: 1,
  },
  {
    method: 'POST',
    pattern: /^\/api\/playlists\/([^/]+)\/import$/,
    action: 'playlist.import',
    target: 1,
  },
  {
    method: 'POST',
    pattern: /^\/api\/music\/jobs\/([^/]+)\/(cancel|retry)$/,
    action: 'music.$2',
    target: 1,
  },
];

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function describe(method: string, path: string): { action: string; target?: string } {
  for (const rule of RULES) {
    const match = rule.method === method ? rule.pattern.exec(path) : null;
    if (match) {
      return {
        action: rule.action.replaceAll(/\$(\d)/g, (_, index: string) => match[Number(index)] ?? ''),
        target: rule.target ? decodeURIComponent(match[rule.target] ?? '') : undefined,
      };
    }
  }

  return { action: `${method} ${path}` };
}

async function failureDetail(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as { error?: unknown; message?: unknown };
    const text = body.error ?? body.message;
    return typeof text === 'string' ? `${response.status}: ${text}` : String(response.status);
  } catch {
    return String(response.status);
  }
}

/**
 * Records every change made from the dashboard: who, what and how it went — a refusal
 * for want of write access is `denied`, anything else that failed is `failed`.
 * Request bodies are never recorded, and music entries carry no more than the
 * status code — what was played or asked for stays out of the log.
 */
export const auditDashboard = createMiddleware<{
  Variables: { identity?: DashboardIdentity; auditNote?: AuditNote };
}>(async (c, next) => {
  await next();

  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  // WHY: an unauthenticated request never reached the route (no identity) — there is
  // nobody to record, and the login flow has its own logging.
  const identity = c.get('identity');
  if (!WRITES.has(method) || path.startsWith('/api/auth/') || !identity) {
    return;
  }

  const { action, target } = describe(method, path);
  // A route may know more than the path does — which feature was switched, and which way.
  const note = c.get('auditNote');
  // Playlists are music: like the rest, recorded without names or tracks.
  const category: AuditCategory =
    path.startsWith('/api/music/') || path.startsWith('/api/playlists') ? 'music' : 'dashboard';
  const status = c.res.status;
  const ok = status < 400;
  // WHY 403 apart: it is only ever `dashboardWrite` refusing a read-only account, which
  // tells a different story from something that broke.
  const outcome: AuditOutcome = ok ? 'ok' : status === 403 ? 'denied' : 'failed';
  let detail = note?.detail;
  if (!ok) {
    detail = category === 'music' ? String(status) : await failureDetail(c.res);
  }

  void audit({
    category,
    action,
    actor: { name: identity.user ?? identity.groups[0] ?? 'dashboard' },
    target: note?.target ?? target,
    outcome,
    detail,
  });
});
