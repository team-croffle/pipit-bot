import { createMiddleware } from 'hono/factory';

import type { EnvConfig } from '../../lib/env.js';

export function isInternalAuthorized(header: string | undefined, token: string): boolean {
  return typeof header === 'string' && header === token;
}

export const internalAuth = createMiddleware<{
  Variables: {
    config: EnvConfig;
  };
}>(async (c, next) => {
  const config = c.get('config');
  const header = c.req.header('x-pipit-internal-token');
  if (!isInternalAuthorized(header, config.internalToken)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
});
