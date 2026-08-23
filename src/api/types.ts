import type { IncomingMessage, ServerResponse } from 'node:http';

import type { EnvConfig } from '../lib/env.js';

export interface ApiLogger {
  info(message: string): void;
  error(message: unknown, ...rest: unknown[]): void;
}

export interface ApiContext {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  url: URL;
  config: EnvConfig;
}

export type RouteHandler = (ctx: ApiContext) => boolean | Promise<boolean>;
