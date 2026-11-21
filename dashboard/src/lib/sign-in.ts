/**
 * Talking to the sign-in endpoints (the bot's /api/auth/*, served by Better Auth).
 *
 * WHY plain fetch and not Better Auth's client: the page needs two calls, and the
 * client would add a dependency to every page's bundle for them.
 */

import { t } from '@/i18n';

export type SignInMethod = 'password' | 'oidc' | 'discord' | 'github';

export interface OfferedMethod {
  method: SignInMethod;
  /** The OIDC button's name; null for the others. */
  label: string | null;
}

/** Where to go after signing in: a path on this site only, never the sign-in page itself. */
export function safeNext(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/';
  }
  if (raw.includes('\\') || raw.startsWith('/login') || raw.startsWith('/api/')) {
    return '/';
  }
  return raw;
}

export function loginPath(next: string): string {
  const target = safeNext(next);
  return target === '/' ? '/login' : `/login?next=${encodeURIComponent(target)}`;
}

/** Sends the browser to the sign-in page, remembering where it was. */
export function redirectToLogin(): void {
  if (window.location.pathname === '/login') {
    return;
  }
  const here = `${window.location.pathname}${window.location.search}`;
  window.location.assign(loginPath(here));
}

export async function fetchMethods(): Promise<OfferedMethod[]> {
  const response = await fetch('/api/auth/methods', { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return ((await response.json()) as { methods: OfferedMethod[] }).methods;
}

/** In the page's language (the browser's, before anyone has signed in). */
export function describeStatus(status: number): string {
  switch (status) {
    case 401:
      return t('login.wrongPassword');
    case 403:
      return t('login.methodOff');
    case 429:
      return t('login.tooMany');
    case 502:
      return t('login.idpDown');
    default:
      return t('login.failedStatus', { status });
  }
}

/** What an `?error=` code sent back by a provider sign-in means. */
export function describeError(code: string): string {
  switch (code) {
    case 'not_allowed':
      return t('login.notAllowed');
    case 'callback_moved':
      return t('login.callbackMoved');
    case 'access_denied':
      return t('login.cancelled');
    default:
      return t('login.unfinished');
  }
}

export async function signInWithPassword(username: string, password: string): Promise<void> {
  const response = await fetch('/api/auth/sign-in/username', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(describeStatus(response.status));
  }
}

/** Starts a provider sign-in; the browser leaves for the provider. */
export async function signInWithProvider(provider: SignInMethod, next: string): Promise<void> {
  const response = await fetch('/api/auth/sign-in/social', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      callbackURL: safeNext(next),
      errorCallbackURL: loginPath(next),
    }),
  });
  if (!response.ok) {
    throw new Error(describeStatus(response.status));
  }
  const body = (await response.json()) as { url?: string };
  if (!body.url) {
    throw new Error(t('login.notStarted'));
  }
  window.location.assign(body.url);
}
