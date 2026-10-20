import type { EnvConfig } from '../lib/env.js';

export interface ApiLogger {
  info(message: string): void;
  error(message: unknown, ...rest: unknown[]): void;
}

/**
 * What a route wants recorded about a request beyond its path. The audit middleware never
 * reads request bodies, so a route that alone knows what it changes leaves this behind.
 */
export interface AuditNote {
  target?: string;
  detail?: string;
}

export type ApiVariables = {
  config: EnvConfig;
  auditNote?: AuditNote;
};
