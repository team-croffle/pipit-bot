import type { TOptions } from 'i18next';

import { translator, type Language } from './index.js';
import type { en } from './locales/en/index.js';

/**
 * A sentence the bot may say in more than one language, carried as a key and its values.
 *
 * WHY not translate where it is made: the same result — "Paused: <track>" — goes to the
 * person who pressed a button (their Discord language), to the music channel (the music
 * feature's language), to the dashboard and to the audit log. So a result keeps the
 * English `message` it always had (the audit log and the API read it) and carries the
 * phrase beside it; whoever shows it picks the language.
 */

/** A notice key; a plural one (`saved_one`, `saved_other`) is named without its suffix and given `count`. */
type WithoutPlural<K> = K extends `${infer Base}_${'one' | 'other'}` ? Base : K;
export type NoticeKey = WithoutPlural<keyof typeof en.notice>;

export interface Phrase {
  key: NoticeKey;
  params?: Record<string, string | number>;
}

/** The English message and the phrase, to spread into a result: `{ ok: true, ...say('paused', { title }) }`. */
export function say(
  key: NoticeKey,
  params?: Record<string, string | number>,
): { message: string; phrase: Phrase } {
  return {
    message: phraseIn('en', { key, params }),
    phrase: params ? { key, params } : { key },
  };
}

/** The same for a notice's second line: `{ ...sayDetail('didNotFit', { count }) }`. */
export function sayDetail(
  key: NoticeKey,
  params?: Record<string, string | number>,
): { detail: string; detailPhrase: Phrase } {
  const { message, phrase } = say(key, params);
  return { detail: message, detailPhrase: phrase };
}

export function phraseIn(language: Language, phrase: Phrase): string {
  return translator(language, 'notice')(phrase.key, phrase.params as TOptions);
}

/** A result's text in a language: its phrase when it has one, else its message as it is. */
export function textIn(language: Language, result: { message: string; phrase?: Phrase }): string {
  return result.phrase ? phraseIn(language, result.phrase) : result.message;
}
