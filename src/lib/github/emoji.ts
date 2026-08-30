/**
 * Resolves `:name:` shortcodes to the guild's custom emoji at send time.
 *
 * WHY templates store the shortcode rather than `<:name:id>`, which is what Discord
 * actually renders: the raw form is unreadable in the editor, and making the input's
 * displayed value differ from its model value breaks the caret and undo. Storing what
 * the operator sees is the same bargain Discord's own message box makes.
 *
 * An unknown name is left exactly as typed. An emoji deleted from the server should
 * cost a notification its picture, not its delivery.
 */

import { container } from '@sapphire/framework';
import type { Guild } from 'discord.js';

import type { EmbedTemplate } from './embed-template.js';

// Discord's own grammar for a custom emoji name.
const SHORTCODE = /:([a-z\d_]{2,32}):/gi;

export function resolveEmojiShortcodes(text: string, guild: Guild | undefined): string {
  if (!guild || !text.includes(':')) {
    return text;
  }

  // Both sources the picker offers. The guild's own wins a name collision, since that
  // is the one an operator browsing this server would have meant.
  const application = container.client?.application;

  return text.replaceAll(SHORTCODE, (whole, name: string) => {
    const wanted = name.toLowerCase();
    const emoji =
      guild.emojis.cache.find((candidate) => candidate.name?.toLowerCase() === wanted) ??
      application?.emojis.cache.find((candidate) => candidate.name?.toLowerCase() === wanted);

    return emoji ? emoji.toString() : whole;
  });
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
  if (!guild) {
    return template;
  }

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
