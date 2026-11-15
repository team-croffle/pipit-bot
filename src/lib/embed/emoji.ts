/**
 * Resolves `:name:` shortcodes at send time: the guild's custom emoji first, then the
 * bot's own, then the standard emoji of that name (`:tada:` → 🎉).
 *
 * WHY templates store the shortcode rather than `<:name:id>`, which is what Discord
 * actually renders: the raw form is unreadable in the editor, and making the input's
 * displayed value differ from its model value breaks the caret and undo. Storing what
 * the operator sees is the same bargain Discord's own message box makes.
 *
 * An unknown name is left exactly as typed. An emoji deleted from the server should
 * cost a notification its picture, not its delivery. Code and links are left alone:
 * `:x:` inside backticks or a URL is not an emoji.
 */

import { container } from '@sapphire/framework';
import type { Guild } from 'discord.js';

import type { EmbedTemplate } from './template.js';
import { unicodeEmoji } from './unicode-emoji.js';

// Wide enough for the standard names (`+1`, `-1`, `100`); a custom emoji's name follows
// Discord's own grammar and is checked separately.
const SHORTCODE = /:([a-z\d_+-]{1,40}):/gi;
const CUSTOM_NAME = /^[a-z\d_]{2,32}$/i;
// Code blocks, inline code, links and Discord's own markup (`<:name:id>`, `<t:…:R>`),
// kept as they are.
const UNTOUCHED = /(```[\s\S]*?```|`[^`\n]*`|<[^\s<>]+>|https?:\/\/\S+)/g;

function customEmoji(name: string, guild: Guild | undefined): string | undefined {
  if (!CUSTOM_NAME.test(name)) {
    return undefined;
  }

  // Both sources the picker offers. The guild's own wins a name collision, since that
  // is the one an operator browsing this server would have meant.
  const wanted = name.toLowerCase();
  const emoji =
    guild?.emojis.cache.find((candidate) => candidate.name?.toLowerCase() === wanted) ??
    container.client?.application?.emojis.cache.find(
      (candidate) => candidate.name?.toLowerCase() === wanted,
    );
  return emoji?.toString();
}

function resolvePlain(text: string, guild: Guild | undefined): string {
  return text.replaceAll(
    SHORTCODE,
    (whole, name: string) => customEmoji(name, guild) ?? unicodeEmoji(name) ?? whole,
  );
}

export function resolveEmojiShortcodes(text: string, guild: Guild | undefined): string {
  if (!text.includes(':')) {
    return text;
  }

  return text
    .split(UNTOUCHED)
    .map((part, index) => (index % 2 === 1 ? part : resolvePlain(part, guild)))
    .join('');
}

/**
 * Resolves the shortcodes in a template, before any payload value is substituted
 * into it.
 *
 * WHY the order: doing it afterwards would let a pull request title carrying
 * `:name:` place a guild emoji. Only wording an operator wrote should be able to.
 */
export function resolveTemplateEmojis(
  template: EmbedTemplate,
  guild: Guild | undefined,
): EmbedTemplate {
  const fill = (text: string): string => resolveEmojiShortcodes(text, guild);

  return {
    ...template,
    content: fill(template.content),
    title: fill(template.title),
    description: fill(template.description),
    footer: fill(template.footer),
    fields: template.fields.map((field) => ({
      ...field,
      name: fill(field.name),
      value: fill(field.value),
    })),
  };
}
