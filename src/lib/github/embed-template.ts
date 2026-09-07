/**
 * The notification embed template.
 *
 * The shape, Discord's limits and the assembly rules live in `lib/embed`; what this
 * file adds is the template layer — every piece of the embed is text run through
 * `renderTemplate`, so the conditional syntax works everywhere.
 */

import type { APIEmbed } from 'discord.js';

import {
  buildApiEmbed,
  clipText,
  emptyEmbedTemplate,
  parseEmbedColor,
  EMBED_LIMIT,
  MAX_EMBED_FIELDS,
  type EmbedFieldTemplate,
  type EmbedTemplate,
} from '../embed/template.js';
import {
  EVENT_VARIABLES,
  parseTemplateText,
  renderTemplate,
  stripDisallowedVariables,
  type GithubEventKey,
  type TemplateValues,
  type TemplateVariable,
} from './template.js';

export { emptyEmbedTemplate, type EmbedFieldTemplate, type EmbedTemplate };

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

  return value.slice(0, MAX_EMBED_FIELDS).map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`${label} field ${index + 1} is not an object`);
    }

    const row = item as Record<string, unknown>;
    return {
      name: parseTemplateText(
        row.name,
        `${label} field ${index + 1} name`,
        allowed,
        EMBED_LIMIT.title,
      ),
      value: parseTemplateText(
        row.value,
        `${label} field ${index + 1} value`,
        allowed,
        EMBED_LIMIT.description,
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
    content: parseTemplateText(row.content, `${label} content`, allowed, EMBED_LIMIT.content),
    title: parseTemplateText(row.title, `${label} title`, allowed, EMBED_LIMIT.title),
    description: parseTemplateText(
      row.description,
      `${label} description`,
      allowed,
      EMBED_LIMIT.description,
    ),
    fields: parseFields(row.fields, label, allowed),
    footer: parseTemplateText(row.footer, `${label} footer`, allowed, EMBED_LIMIT.footer),
    color: parseEmbedColor(row.color, `${label} colour`),
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

function fill(template: string, values: TemplateValues, max: number): string {
  return clipText(renderTemplate(template, values), max);
}

/**
 * Fills the template. Anything that renders empty is left out entirely rather than
 * sent as a blank line — that is what makes `{name|then|else}` worth writing.
 */
export function renderEmbedTemplate(
  template: EmbedTemplate,
  values: TemplateValues,
  now: Date = new Date(),
): RenderedEmbed {
  return {
    content: fill(template.content, values, EMBED_LIMIT.content),
    embed: buildApiEmbed(
      {
        title: fill(template.title, values, EMBED_LIMIT.title),
        description: fill(template.description, values, EMBED_LIMIT.description),
        footer: fill(template.footer, values, EMBED_LIMIT.footer),
        fields: template.fields.map((field) => ({
          name: fill(field.name, values, EMBED_LIMIT.fieldName),
          value: fill(field.value, values, EMBED_LIMIT.fieldValue),
          inline: field.inline,
        })),
        // The link belongs on the title rather than in the plain line, where a bare
        // URL would unfurl a second preview card under the embed.
        url: values.pr_url,
        color: template.color,
        showTimestamp: template.showTimestamp,
      },
      now,
    ),
  };
}
