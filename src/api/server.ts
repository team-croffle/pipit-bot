import { serve } from '@hono/node-server';

import type { EnvConfig } from '../lib/env.js';
import { createApp } from './app.js';
import type { ApiLogger } from './context.js';

export type { ApiLogger } from './context.js';

export function startApiServer(config: EnvConfig, logger: ApiLogger): void {
  const app = createApp(config);

  serve(
    {
      fetch: app.fetch,
      port: config.apiPort,
    },
    () => {
      logger.info(`pipit-api listening on port ${config.apiPort}`);
    },
  );
}
