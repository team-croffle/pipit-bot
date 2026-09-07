/**
 * The embed an operator composes in the dashboard.
 *
 * WHY this lives outside any one feature: the GitHub reminder was the first thing to
 * need it, but the shape, Discord's limits, and the rules for what counts as an empty
 * embed are the same wherever the bot sends operator-written wording. The reminder
 * layers template variables on top; nothing here knows about them.
 *
 * WHY there is a plain `content` line above the embed: Discord does not raise a
 * notification for a mention that only appears inside an embed. Pings can live in
 * `content` and nowhere else, which is why the embed cannot replace it outright.
 */

import type { APIEmbed } from 'discord.js';

export interface EmbedFieldTemplate {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedTemplate {
  /** Plain text above the embed — the only place a mention actually pings. */
  content: string;
  title: string;
  description: string;
  fields: EmbedFieldTemplate[];
  footer: string;
  /** `#rrggbb`, or '' to leave the embed uncoloured. */
  color: string;
  showTimestamp: boolean;
}

// Discord's own caps. Exceeding any one of them fails the whole send.
export const EMBED_LIMIT = {
  content: 2000,
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  total: 6000,
} as const;

export const MAX_EMBED_FIELDS = 10;

const HEX_COLOR = /^#[\da-f]{6}$/i;

export function emptyEmbedTemplate(): EmbedTemplate {
  return {
    content: '',
    title: '',
    description: '',
    fields: [],
    footer: '',
    color: '',
    showTimestamp: false,
  };
}

export function clipText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function parseEmbedColor(value: unknown, label: string): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    throw new Error(`${label} must be a #rrggbb colour`);
  }

  return value.toLowerCase();
}

/** One piece of wording with no variables in it, clipped to its Discord cap. */
export function parsePlainText(value: unknown, label: string, max: number): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }

  if (value.length > max) {
    throw new Error(`${label} is longer than ${max} characters`);
  }

  return value;
}

function parsePlainFields(value: unknown, label: string): EmbedFieldTemplate[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${label} fields must be an array`);
  }

  return value.slice(0, MAX_EMBED_FIELDS).map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`${label} field ${index + 1} is not an object`);
    }

    const row = item as Record<string, unknown>;
    return {
      name: parsePlainText(row.name, `${label} field ${index + 1} name`, EMBED_LIMIT.fieldName),
      value: parsePlainText(row.value, `${label} field ${index + 1} value`, EMBED_LIMIT.fieldValue),
      inline: row.inline === true,
    };
  });
}

/** Validates a stored embed that is sent exactly as written, with no substitution. */
export function parsePlainEmbedTemplate(value: unknown, label: string): EmbedTemplate {
  if (value === null || value === undefined) {
    return emptyEmbedTemplate();
  }

  if (typeof value !== 'object') {
    throw new Error(`${label} must be an object`);
  }

  const row = value as Record<string, unknown>;

  return {
    content: parsePlainText(row.content, `${label} content`, EMBED_LIMIT.content),
    title: parsePlainText(row.title, `${label} title`, EMBED_LIMIT.title),
    description: parsePlainText(row.description, `${label} description`, EMBED_LIMIT.description),
    fields: parsePlainFields(row.fields, label),
    footer: parsePlainText(row.footer, `${label} footer`, EMBED_LIMIT.footer),
    color: parseEmbedColor(row.color, `${label} colour`),
    showTimestamp: row.showTimestamp === true,
  };
}

function embedLength(embed: APIEmbed): number {
  return (
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    (embed.footer?.text.length ?? 0) +
    (embed.fields ?? []).reduce((sum, field) => sum + field.name.length + field.value.length, 0)
  );
}

/** The finished text of an embed, ready to be handed to Discord. */
export interface EmbedParts {
  title: string;
  description: string;
  footer: string;
  fields: EmbedFieldTemplate[];
  /** A link on the title, where it cannot unfurl a second preview card. */
  url?: string | undefined;
  color: string;
  showTimestamp: boolean;
}

/**
 * Assembles the parts into an embed, leaving out anything that came out empty rather
 * than sending it as a blank line.
 *
 * Returns `undefined` when nothing survived, so the caller can tell "no embed" from
 * "an embed with empty parts", which Discord rejects.
 */
export function buildApiEmbed(parts: EmbedParts, now: Date = new Date()): APIEmbed | undefined {
  const embed: APIEmbed = {};

  if (parts.title) {
    embed.title = parts.title;
    if (parts.url) {
      embed.url = parts.url;
    }
  }
  if (parts.description) {
    embed.description = parts.description;
  }

  // Discord rejects a field with an empty name or value, so a field whose value
  // conditioned itself away takes its label with it.
  const fields = parts.fields.filter((field) => field.name && field.value);
  if (fields.length > 0) {
    embed.fields = fields;
  }

  if (parts.footer) {
    embed.footer = { text: parts.footer };
  }
  if (parts.color) {
    embed.color = Number.parseInt(parts.color.slice(1), 16);
  }
  if (parts.showTimestamp) {
    embed.timestamp = now.toISOString();
  }

  // The per-part caps can still add up past the whole-embed cap; drop fields from
  // the end until it fits rather than letting Discord reject the send outright.
  while (embed.fields && embed.fields.length > 0 && embedLength(embed) > EMBED_LIMIT.total) {
    embed.fields.pop();
  }

  // Colour and timestamp alone are not an embed — they would render as a bare stripe.
  const hasBody = Object.keys(embed).some((key) => key !== 'color' && key !== 'timestamp');

  return hasBody ? embed : undefined;
}

/** Builds the embed for wording that is sent exactly as stored. */
export function renderPlainEmbed(
  template: EmbedTemplate,
  now: Date = new Date(),
): { content: string; embed: APIEmbed | undefined } {
  return {
    content: clipText(template.content, EMBED_LIMIT.content),
    embed: buildApiEmbed(
      {
        title: clipText(template.title, EMBED_LIMIT.title),
        description: clipText(template.description, EMBED_LIMIT.description),
        footer: clipText(template.footer, EMBED_LIMIT.footer),
        fields: template.fields.map((field) => ({
          name: clipText(field.name, EMBED_LIMIT.fieldName),
          value: clipText(field.value, EMBED_LIMIT.fieldValue),
          inline: field.inline,
        })),
        color: template.color,
        showTimestamp: template.showTimestamp,
      },
      now,
    ),
  };
}
