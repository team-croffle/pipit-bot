import type { IncomingMessage } from 'node:http';

export function isInternalAuthorized(req: IncomingMessage, token: string): boolean {
  const header = req.headers['x-pipit-internal-token'];
  if (typeof header !== 'string') {
    return false;
  }

  return header === token;
}
