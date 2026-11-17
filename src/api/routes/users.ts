import type { Context, Hono } from 'hono';

import type { EnvConfig } from '../../lib/env.js';
import { changeUser, listUserViews, removeUser } from '../../lib/users/manage.js';
import { createPasswordUser, setUserPassword, UserInputError } from '../../lib/users/passwords.js';
import { findUserById } from '../../lib/users/store.js';
import { dashboardViewer, dashboardWrite, type DashboardIdentity } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

/**
 * The users page: everyone may see who is on the dashboard; admins add password accounts,
 * set passwords, give or take admin, enter the GitHub login and Discord id a person is
 * known by, and remove users (lib/users/manage.ts). Nothing here returns a password hash,
 * a session or an address. Better Auth's own admin endpoints are not reachable.
 */
export function mountUserRoutes(app: Hono<{ Variables: ApiVariables }>, config: EnvConfig): void {
  const actor = (c: Context) => (c.get('identity') as DashboardIdentity | undefined)?.userId;

  async function answer(c: Context, work: () => Promise<unknown>) {
    try {
      await work();
      return c.json({ users: await listUserViews(config) });
    } catch (error) {
      if (error instanceof UserInputError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  }

  app.get('/api/users', dashboardViewer, async (c) =>
    c.json({ users: await listUserViews(config) }),
  );

  app.post('/api/users', dashboardViewer, dashboardWrite, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    return answer(c, async () => {
      const user = await createPasswordUser(config, {
        username: body.username,
        password: body.password,
      });
      c.set('auditNote', { target: user.username ?? user.name });
      if (body.admin === true) {
        await changeUser(config, actor(c), user.id, { admin: true });
      }
    });
  });

  app.patch('/api/users/:id', dashboardViewer, dashboardWrite, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    return answer(c, async () => {
      const user = await changeUser(config, actor(c), c.req.param('id'), body);
      c.set('auditNote', { target: user.name, detail: Object.keys(body).join(',') });
    });
  });

  app.post('/api/users/:id/password', dashboardViewer, dashboardWrite, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    return answer(c, async () => {
      await setUserPassword(config, c.req.param('id'), body.password);
      c.set('auditNote', { target: findUserById(c.req.param('id'))?.name });
    });
  });

  app.delete('/api/users/:id', dashboardViewer, dashboardWrite, async (c) =>
    answer(c, async () => {
      const user = await removeUser(config, actor(c), c.req.param('id'));
      c.set('auditNote', { target: user.name });
    }),
  );
}
