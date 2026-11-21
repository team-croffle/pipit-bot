import type { Context } from 'hono';

import { isLanguage, type Language } from '../lib/i18n/index.js';
import { getLanguageSettings } from '../lib/i18n/settings.js';
import { findUserById } from '../lib/users/store.js';
import type { DashboardIdentity } from './auth/dashboard.js';

/**
 * The language of the person behind a dashboard request, for the few answers the
 * dashboard shows as they are (v0.8.3): their own choice, then the server default, then
 * the browser's — the same order the dashboard uses for itself.
 */
export function requestLanguage(c: Context): Language {
  const identity = c.get('identity') as DashboardIdentity | undefined;
  const own = findUserById(identity?.userId)?.locale;
  if (isLanguage(own)) {
    return own;
  }
  const server = getLanguageSettings().dashboard;
  if (server) {
    return server;
  }
  return c.req.header('accept-language')?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}
