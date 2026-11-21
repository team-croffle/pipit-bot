import { createI18n } from 'vue-i18n';

import { en } from './locales/en';
import { ko } from './locales/ko';

/**
 * The dashboard in English and Korean (vue-i18n, Composition API).
 *
 * Which one: the person's own choice, then the server's dashboard default, then the
 * browser's language (v0.8.3, the team). Before sign-in only the browser is known.
 * Resources are TypeScript modules, one file per namespace, like the bot's.
 */

export type Language = 'en' | 'ko';

export function browserLanguage(): Language {
  return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export const i18n = createI18n({
  legacy: false,
  locale: browserLanguage(),
  fallbackLocale: 'en',
  messages: { en, ko },
  // `{count}` plurals and named values only; no HTML in messages.
  warnHtmlMessage: false,
});

export function setLanguage(language: Language): void {
  i18n.global.locale.value = language;
  document.documentElement.lang = language;
}

/** The language for a signed-in person (see above). */
export function resolveLanguage(
  own: string | null | undefined,
  server: string | null | undefined,
): Language {
  if (own === 'ko' || own === 'en') {
    return own;
  }
  if (server === 'ko' || server === 'en') {
    return server;
  }
  return browserLanguage();
}

/** A translation outside components (lib/ helpers). */
export const t = i18n.global.t;

/** The current locale for Intl formatting. */
export function intlLocale(): string {
  return i18n.global.locale.value === 'ko' ? 'ko-KR' : 'en-US';
}
