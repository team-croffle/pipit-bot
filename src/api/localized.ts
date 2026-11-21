import type { Context } from 'hono';

import { phraseIn, say, textIn, type NoticeKey, type Phrase } from '../lib/i18n/phrase.js';
import { requestLanguage } from './language.js';

/**
 * Answers the dashboard shows as they are, in the viewer's language (v0.8.3). A result
 * keeps its phrase; only `message` changes. The audit log is written from the response
 * status for music and playlists, so it stays English whatever is answered here.
 */
export function localized<T extends { message: string; phrase?: Phrase }>(
  c: Context,
  result: T,
): T {
  return result.phrase ? { ...result, message: textIn(requestLanguage(c), result) } : result;
}

/** An error's text: its phrase in the viewer's language when it has one, else as it is. */
export function errorText(c: Context, error: { message: string; phrase?: Phrase }): string {
  return error.phrase ? phraseIn(requestLanguage(c), error.phrase) : error.message;
}

/** A notice key's text in the viewer's language, for an `{ error }` answer. */
export function sayTo(
  c: Context,
  key: NoticeKey,
  params?: Record<string, string | number>,
): string {
  return textIn(requestLanguage(c), say(key, params));
}
