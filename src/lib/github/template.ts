/**
 * The notification message template.
 *
 * The template itself is written by an operator through the dashboard, so it is
 * inserted as-is and may use any Discord markdown. Everything substituted into it
 * comes off the webhook payload and is sanitized by the caller — that boundary is
 * what keeps a pull request title from forging mentions or links.
 */

export const DEFAULT_TEMPLATE =
  '**{event}** · `{repo}` [#{pr_number}]({pr_url}) — {pr_title}\n{mentions}';

const MAX_TEMPLATE_LENGTH = 2000;

export const TEMPLATE_VARIABLES = [
  'repo',
  'pr_number',
  'pr_url',
  'pr_title',
  'event',
  'actor',
  'author',
  'assignees',
  'reviewers',
  'mentions',
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export type TemplateValues = Record<TemplateVariable, string>;

const NAMES = new Set<string>(TEMPLATE_VARIABLES);
// WHY: a placeholder is `{name}`, `{name|tail}` or `{name|tail|fallback}`. A branch
// may carry `{}` to say where the value goes; without one the value is prefixed.
const PLACEHOLDER = /\{([a-z_]+)((?:\|(?:[^{}|]|\{\})*){0,2})\}/g;
const VALUE_SLOT = '{}';

function renderBranch(branch: string, value: string): string {
  return branch.includes(VALUE_SLOT) ? branch.replaceAll(VALUE_SLOT, value) : `${value}${branch}`;
}

/** Returns the variable names a template uses, including any that do not exist. */
export function readTemplateVariables(template: string): string[] {
  const found: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = match[1];
    if (name && !found.includes(name)) {
      found.push(name);
    }
  }

  return found;
}

/** The names in a template that are not variables — surfaced as a save-time error. */
export function findUnknownVariables(template: string): string[] {
  return readTemplateVariables(template).filter((name) => !NAMES.has(name));
}

/**
 * Fills a template in a single pass. Substituted text is never rescanned, so a
 * value that happens to contain braces cannot introduce a placeholder of its own.
 */
export function renderTemplate(template: string, values: TemplateValues): string {
  const rendered = template.replaceAll(PLACEHOLDER, (whole, rawName: string, rawTail: string) => {
    if (!NAMES.has(rawName)) {
      return whole;
    }

    const value = values[rawName as TemplateVariable];
    const branches = rawTail ? rawTail.slice(1).split('|') : [];
    if (value) {
      return branches.length > 0 ? renderBranch(branches[0] ?? '', value) : value;
    }

    return branches.length > 1 ? (branches[1] ?? '') : '';
  });

  // WHY: nothing else is rewritten. Collapsing blank lines was tempting, but the
  // operator controls emptiness through the fallback branch, and silently dropping
  // their spacing would be the more surprising behaviour.
  return rendered.trim();
}

/**
 * Validates one stored template. Returns null for "unset"; throws when the text is
 * present but unusable.
 *
 * WHY the unknown-variable check happens on save: a typo would otherwise sit in the
 * template until an event fired, and then render as literal `{revewers}` in a
 * channel — or as nothing at all.
 */
export function parseTemplateText(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${label} must be text`);
  }

  if (value.length > MAX_TEMPLATE_LENGTH) {
    throw new Error(`${label} must be ${MAX_TEMPLATE_LENGTH} characters or fewer`);
  }

  const unknown = findUnknownVariables(value);
  if (unknown.length > 0) {
    throw new Error(`${label} uses unknown variables: ${unknown.join(', ')}`);
  }

  return value;
}

/** Validates a per-event override map, keeping only the keys that carry wording. */
export function parseTemplateMap<Key extends string>(
  value: unknown,
  keys: readonly Key[],
): Partial<Record<Key, string>> {
  if (value === null || value === undefined) {
    return {};
  }

  if (typeof value !== 'object') {
    throw new Error('eventTemplates must be an object');
  }

  const row = value as Record<string, unknown>;
  const templates: Partial<Record<Key, string>> = {};
  for (const key of keys) {
    const template = parseTemplateText(row[key], `Template for ${key}`);
    if (template) {
      templates[key] = template;
    }
  }

  return templates;
}
