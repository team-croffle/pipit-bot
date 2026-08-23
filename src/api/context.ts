import type { EnvConfig } from '../lib/env.js';

export interface ApiLogger {
  info(message: string): void;
  error(message: unknown, ...rest: unknown[]): void;
}

export type ApiVariables = {
  config: EnvConfig;
};
