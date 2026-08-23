import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SessionPayload {
  user: string;
  groups: string[];
  exp: number;
}

const SESSION_COOKIE = 'pipit_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>, secret: string): string {
  const body: SessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = encodeBase64Url(JSON.stringify(body));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function parseSessionToken(
  token: string | undefined,
  secret: string,
): SessionPayload | null {
  if (!token) {
    return null;
  }

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) {
    return null;
  }

  const expected = sign(encoded, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encoded)) as SessionPayload;
    if (!payload.user || !Array.isArray(payload.groups) || typeof payload.exp !== 'number') {
      return null;
    }
    if (payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE, SESSION_TTL_MS };
