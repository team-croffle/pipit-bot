import { createMiddleware } from 'hono/factory';

import { audit } from '../lib/audit/log.js';
import type { AuditCategory } from '../lib/audit/types.js';
import type { DashboardIdentity } from './auth/dashboard.js';

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
 * Records every change made from the dashboard: who, what and whether it worked.
 * Request bodies are never recorded, and music entries carry no more than the
 * status code — what was played or asked for stays out of the log.
 */
export const auditDashboard = createMiddleware<{
  Variables: { identity?: DashboardIdentity };
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
  const category: AuditCategory = path.startsWith('/api/music/') ? 'music' : 'dashboard';
  const ok = c.res.status < 400;
  let detail: string | undefined;
  if (!ok) {
    detail = category === 'music' ? String(c.res.status) : await failureDetail(c.res);
  }

  void audit({
    category,
    action,
    actor: { name: identity.user ?? identity.groups[0] ?? 'dashboard' },
    target,
    outcome: ok ? 'ok' : 'failed',
    detail,
  });
});
