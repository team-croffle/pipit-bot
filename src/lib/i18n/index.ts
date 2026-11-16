import { createInstance, type TFunction } from 'i18next';

import { en } from './locales/en.js';
import { ko } from './locales/ko.js';

/**
 * The bot's own words in more than one language (i18next).
 *
 * WHY only some features: the recap is the first to choose its language (v0.8.1); the
 * rest of the bot still speaks English and moves here feature by feature (v0.8.3). A
 * message posted to a channel follows that feature's language setting; a reply only
 * one person sees follows that person's Discord language.
 *
 * Resources are TypeScript modules rather than JSON, so the build carries them as is.
 */

export const LANGUAGES = ['en', 'ko'] as const;
export type Language = (typeof LANGUAGES)[number];
export type Namespace = keyof typeof en;

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** A Discord locale (`ko`, `en-US`, …) as one of ours; anything else is English. */
export function languageOfLocale(locale: string | null | undefined): Language {
  return locale?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

const i18n = createInstance();
void i18n.init({
  resources: { en, ko },
  lng: 'en',
  fallbackLng: 'en',
  ns: Object.keys(en),
  defaultNS: 'recap',
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** A translator for one language and one feature. */
export function translator(language: Language, ns: Namespace): TFunction {
  return i18n.getFixedT(language, ns);
}
