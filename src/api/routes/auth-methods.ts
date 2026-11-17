import type { Hono } from 'hono';

import {
  getAuthMethodStates,
  isAuthMethodsFallback,
  saveAuthMethods,
} from '../../lib/auth/methods.js';
import type { EnvConfig } from '../../lib/env.js';
import { dashboardViewer, dashboardWrite } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

/**
 * The sign-in methods: the public list the sign-in page draws (only what is on, never a
 * secret), and the switches on the settings page (lib/auth/methods.ts).
 */
export function mountAuthMethodRoutes(
  app: Hono<{ Variables: ApiVariables }>,
  config: EnvConfig,
): void {
  app.get('/api/auth/methods', (c) =>
    c.json({
      methods: getAuthMethodStates()
        .filter((state) => state.active)
        .map((state) => ({
          method: state.method,
          label: state.method === 'oidc' ? (config.auth.oidc?.displayName ?? 'SSO') : null,
        })),
    }),
  );

  app.get('/api/settings/auth-methods', dashboardViewer, (c) =>
    c.json({ methods: getAuthMethodStates(), fallback: isAuthMethodsFallback() }),
  );

  app.put('/api/settings/auth-methods', dashboardViewer, dashboardWrite, async (c) => {
    const body = await c.req.json<{ methods?: unknown }>().catch(() => ({}));
    const change = (body as { methods?: unknown }).methods;
    try {
      const methods = await saveAuthMethods(change);
      c.set('auditNote', {
        detail: methods.map((state) => `${state.method}=${state.enabled ? 'on' : 'off'}`).join(' '),
      });
      return c.json({ methods, fallback: false });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Invalid change' }, 400);
    }
  });
}
