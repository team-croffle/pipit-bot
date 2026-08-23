import { createServer } from 'node:http';

import type { EnvConfig } from '../lib/env.js';
import { sendJson } from './http.js';
import { routes } from './routes/index.js';
import type { ApiLogger } from './types.js';

export type { ApiLogger } from './types.js';

export function startApiServer(config: EnvConfig, logger: ApiLogger): void {
  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? 'GET';
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      for (const route of routes) {
        if (await route({ req, res, method, url, config })) {
          return;
        }
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      logger.error('API handler error:', error);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  });

  server.listen(config.apiPort, () => {
    logger.info(`pipit-api listening on port ${config.apiPort}`);
  });
}
