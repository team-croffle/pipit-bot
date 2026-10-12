import type { Hono } from 'hono';

import { MAX_LIMIT, queryAudit } from '../../lib/audit/query.js';
import { isAuditCategory, type AuditCategory } from '../../lib/audit/types.js';
import { dashboardViewer } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

const ISO_TIME = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/;

export function mountAuditRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  app.get('/api/audit', dashboardViewer, async (c) => {
    const { from, to, before, q, category, limit } = c.req.query();
    for (const [name, value] of Object.entries({ from, to, before })) {
      if (value && !ISO_TIME.test(value)) {
        return c.json({ error: `${name} must be an ISO date or UTC time` }, 400);
      }
    }

    const categories = (category ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const unknown = categories.find((item) => !isAuditCategory(item));
    if (unknown) {
      return c.json({ error: `Unknown category: ${unknown}` }, 400);
    }

    const size = limit === undefined ? undefined : Number(limit);
    if (size !== undefined && (!Number.isInteger(size) || size < 1 || size > MAX_LIMIT)) {
      return c.json({ error: `limit must be 1–${MAX_LIMIT}` }, 400);
    }

    return c.json(
      await queryAudit({
        from,
        to,
        before,
        search: q,
        categories: categories as AuditCategory[],
        limit: size,
      }),
    );
  });
}
