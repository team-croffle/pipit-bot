/**
 * The notification embed template.
 *
 * An operator composes the embed in the dashboard; every piece of it is template
 * text run through `renderTemplate`, so the conditional syntax works everywhere.
 *
 * WHY there is still a plain `content` line above the embed: Discord does not raise
 * a notification for a mention that only appears inside an embed. Pings can live in
 * `content` and nowhere else, which is why the embed cannot replace it outright.
 */

import type { APIEmbed } from 'discord.js';

import {
  EVENT_VARIABLES,
  parseTemplateText,
  renderTemplate,
  stripDisallowedVariables,
  type GithubEventKey,
  type TemplateValues,
  type TemplateVariable,
} from './template.js';

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
const LIMIT = {
  content: 2000,
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  total: 6000,
} as const;

const MAX_FIELDS = 10;
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

function parseColor(value: unknown, label: string): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    throw new Error(`${label} must be a #rrggbb colour`);
  }

  return value.toLowerCase();
}

function parseFields(
  value: unknown,
  label: string,
  allowed: readonly TemplateVariable[],
): EmbedFieldTemplate[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${label} fields must be an array`);
  }

  return value.slice(0, MAX_FIELDS).map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`${label} field ${index + 1} is not an object`);
    }

    const row = item as Record<string, unknown>;
    return {
      name: parseTemplateText(row.name, `${label} field ${index + 1} name`, allowed, LIMIT.title),
      value: parseTemplateText(
        row.value,
        `${label} field ${index + 1} value`,
        allowed,
        LIMIT.description,
      ),
      inline: row.inline === true,
    };
  });
}

/**
 * Turns the wording that v0.6.2 stored as one string into an embed.
 *
 * WHY `{mentions}` moves out of the text: left in the description it would render
 * but never notify anybody, so a faithful-looking migration would quietly break the
 * one thing the reminder exists to do. It is promoted to `content` instead, and the
 * placeholder is dropped from the description so it does not read twice.
 */
function fromLegacyText(text: string, allowed: readonly TemplateVariable[]): EmbedTemplate {
  const mentions = text.includes('{mentions}');
  const body = mentions ? text.replaceAll('{mentions}', '') : text;

  return {
    ...emptyEmbedTemplate(),
    content: mentions ? '{mentions}' : '',
    // Pruned rather than rejected — see stripDisallowedVariables.
    description: stripDisallowedVariables(body, allowed).trim(),
  };
}

/**
 * Parses one stored template. Accepts the v0.6.2 string form and migrates it, so an
 * existing `github-notify.json` keeps working and is rewritten on the next save.
 */
export function parseEmbedTemplate(
  value: unknown,
  label: string,
  allowed: readonly TemplateVariable[],
): EmbedTemplate {
  if (value === null || value === undefined) {
    return emptyEmbedTemplate();
  }

  if (typeof value === 'string') {
    return parseEmbedTemplate(fromLegacyText(value, allowed), label, allowed);
  }

  if (typeof value !== 'object') {
    throw new Error(`${label} must be an object`);
  }

  const row = value as Record<string, unknown>;

  return {
    content: parseTemplateText(row.content, `${label} content`, allowed, LIMIT.content),
    title: parseTemplateText(row.title, `${label} title`, allowed, LIMIT.title),
    description: parseTemplateText(
      row.description,
      `${label} description`,
      allowed,
      LIMIT.description,
    ),
    fields: parseFields(row.fields, label, allowed),
    footer: parseTemplateText(row.footer, `${label} footer`, allowed, LIMIT.footer),
    color: parseColor(row.color, `${label} colour`),
    showTimestamp: row.showTimestamp === true,
  };
}

/** Validates the per-event override map, keeping only the events that carry wording. */
export function parseEmbedTemplateMap(
  value: unknown,
  keys: readonly GithubEventKey[],
): Partial<Record<GithubEventKey, EmbedTemplate>> {
  if (value === null || value === undefined) {
    return {};
  }

  if (typeof value !== 'object') {
    throw new Error('eventTemplates must be an object');
  }

  const row = value as Record<string, unknown>;
  const templates: Partial<Record<GithubEventKey, EmbedTemplate>> = {};
  for (const key of keys) {
    const stored = row[key];
    if (stored === null || stored === undefined) {
      continue;
    }

    templates[key] = parseEmbedTemplate(stored, `Template for ${key}`, EVENT_VARIABLES[key]);
  }

  return templates;
}

export interface RenderedEmbed {
  content: string;
  embed: APIEmbed | undefined;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function fill(template: string, values: TemplateValues, max: number): string {
  return clip(renderTemplate(template, values), max);
}

function embedLength(embed: APIEmbed): number {
  return (
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    (embed.footer?.text.length ?? 0) +
    (embed.fields ?? []).reduce((sum, field) => sum + field.name.length + field.value.length, 0)
  );
}

/**
 * Fills the template. Anything that renders empty is left out entirely rather than
 * sent as a blank line — that is what makes `{name|then|else}` worth writing.
 *
 * Returns `embed: undefined` when nothing but the plain line survived, so the caller
 * can tell "no embed" from "an embed with empty parts", which Discord rejects.
 */
export function renderEmbedTemplate(
  template: EmbedTemplate,
  values: TemplateValues,
  now: Date = new Date(),
): RenderedEmbed {
  const title = fill(template.title, values, LIMIT.title);
  const description = fill(template.description, values, LIMIT.description);
  const footer = fill(template.footer, values, LIMIT.footer);

  const fields = template.fields
    .map((field) => ({
      name: fill(field.name, values, LIMIT.fieldName),
      value: fill(field.value, values, LIMIT.fieldValue),
      inline: field.inline,
    }))
    // Discord rejects a field with an empty name or value, so a field whose value
    // conditioned itself away takes its label with it.
    .filter((field) => field.name && field.value);

  const embed: APIEmbed = {};
  if (title) {
    embed.title = title;
    // The link belongs on the title rather than in the plain line, where a bare URL
    // would unfurl a second preview card under the embed.
    embed.url = values.pr_url;
  }
  if (description) {
    embed.description = description;
  }
  if (fields.length > 0) {
    embed.fields = fields;
  }
  if (footer) {
    embed.footer = { text: footer };
  }
  if (template.color) {
    embed.color = Number.parseInt(template.color.slice(1), 16);
  }
  if (template.showTimestamp) {
    embed.timestamp = now.toISOString();
  }

  // The per-part caps can still add up past the whole-embed cap; drop fields from
  // the end until it fits rather than letting Discord reject the send outright.
  while (embed.fields && embed.fields.length > 0 && embedLength(embed) > LIMIT.total) {
    embed.fields.pop();
  }

  // Colour and timestamp alone are not an embed — they would render as a bare stripe.
  const hasBody = Object.keys(embed).some((key) => key !== 'color' && key !== 'timestamp');

  return {
    content: fill(template.content, values, LIMIT.content),
    embed: hasBody ? embed : undefined,
  };
}
