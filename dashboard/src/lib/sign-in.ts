/**
 * Talking to the sign-in endpoints (the bot's /api/auth/*, served by Better Auth).
 *
 * WHY plain fetch and not Better Auth's client: the page needs two calls, and the
 * client would add a dependency to every page's bundle for them.
 */

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

/** English, like the rest of the sign-in page. */
export function describeStatus(status: number): string {
  switch (status) {
    case 401:
      return 'The user name or password is wrong.';
    case 403:
      return 'This sign-in method is switched off.';
    case 429:
      return 'Too many attempts. Wait a minute and try again.';
    case 502:
      return 'The identity provider could not be reached. Try again later.';
    default:
      return `Signing in failed (${status}).`;
  }
}

/** What an `?error=` code sent back by a provider sign-in means. */
export function describeError(code: string): string {
  switch (code) {
    case 'not_allowed':
      return 'This account may not sign in. Ask an admin to add you.';
    case 'callback_moved':
      return 'The identity provider uses an old callback address. Ask the operator to update it.';
    case 'access_denied':
      return 'Signing in was cancelled.';
    default:
      return 'Signing in did not finish. Try again.';
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
    throw new Error('Signing in did not start. Try again.');
  }
  window.location.assign(body.url);
}
