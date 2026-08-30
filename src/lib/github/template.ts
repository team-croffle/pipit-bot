/**
 * The notification message template.
 *
 * The template itself is written by an operator through the dashboard, so it is
 * inserted as-is and may use any Discord markdown. Everything substituted into it
 * comes off the webhook payload and is sanitized by the caller — that boundary is
 * what keeps a pull request title from forging mentions or links.
 */

import type { GithubEventToggles } from './settings.js';

const MAX_TEMPLATE_LENGTH = 2000;

export const TEMPLATE_VARIABLES = [
  'repo',
  'pr_number',
  'pr_url',
  'pr_title',
  'event',
  'actor',
  'author',
  'assignee',
  'assignees',
  'reviewers',
  'mentions',
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export type TemplateValues = Record<TemplateVariable, string>;

export type GithubEventKey = keyof GithubEventToggles;

// Describe the subject rather than the action, so every event carries them.
const COMMON: readonly TemplateVariable[] = ['repo', 'pr_number', 'pr_url', 'pr_title', 'event'];

/**
 * What each event can actually fill in.
 *
 * WHY this is not one flat list: `{actor}` is a different person per event, and two
 * variables are only sometimes populated. `{reviewers}` reads `requested_reviewers`,
 * which GitHub empties once the review lands — offering it on `reviewSubmitted` or
 * `pullRequestMerged` produced wording that silently rendered to nothing. Rejecting
 * those at save time is the same bargain `findUnknownVariables` already makes: catch
 * it in the dashboard, not in a channel three days later.
 */
export const EVENT_VARIABLES: Record<GithubEventKey, readonly TemplateVariable[]> = {
  pullRequestOpened: [...COMMON, 'actor', 'author', 'reviewers', 'assignees', 'mentions'],
  pullRequestUpdated: [...COMMON, 'actor', 'author', 'reviewers', 'assignees', 'mentions'],
  pullRequestMerged: [...COMMON, 'actor', 'author', 'assignees', 'mentions'],
  pullRequestAssigned: [
    ...COMMON,
    'actor',
    'author',
    'assignee',
    'assignees',
    'reviewers',
    'mentions',
  ],
  issueOpened: [...COMMON, 'actor', 'author', 'assignees', 'mentions'],
  issueAssigned: [...COMMON, 'actor', 'assignee', 'assignees', 'mentions'],
  reviewSubmitted: [...COMMON, 'actor', 'author', 'mentions'],
  commentCreated: [...COMMON, 'actor', 'author', 'mentions'],
};

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

/**
 * The names in a template that it may not use — surfaced as a save-time error.
 * Without `allowed` this is "is it a variable at all"; with one it also asks whether
 * the event being edited can fill it in.
 */
export function findUnusableVariables(
  template: string,
  allowed: readonly TemplateVariable[] = TEMPLATE_VARIABLES,
): string[] {
  const permitted = new Set<string>(allowed);
  return readTemplateVariables(template).filter((name) => !permitted.has(name));
}

/**
 * Drops the placeholders an event cannot fill, leaving the rest of the text alone.
 *
 * WHY this exists next to the strict check: wording saved before per-event scoping
 * may name a variable the event no longer offers. Refusing to parse it would make
 * the whole settings file unreadable and reset every other setting with it, so the
 * migration path prunes where the dashboard path rejects.
 */
export function stripDisallowedVariables(
  template: string,
  allowed: readonly TemplateVariable[],
): string {
  const permitted = new Set<string>(allowed);
  return template.replaceAll(PLACEHOLDER, (whole, rawName: string) =>
    NAMES.has(rawName) && !permitted.has(rawName) ? '' : whole,
  );
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
 * Validates one piece of template text. Returns '' for "unset"; throws when the text
 * is present but unusable.
 *
 * WHY the variable check happens on save: a typo would otherwise sit in the template
 * until an event fired, and then render as literal `{revewers}` in a channel — or as
 * nothing at all.
 */
export function parseTemplateText(
  value: unknown,
  label: string,
  allowed?: readonly TemplateVariable[],
  maxLength = MAX_TEMPLATE_LENGTH,
): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value !== 'string') {
    throw new Error(`${label} must be text`);
  }

  if (value.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer`);
  }

  const unusable = findUnusableVariables(value, allowed);
  if (unusable.length > 0) {
    throw new Error(`${label} cannot use: ${unusable.join(', ')}`);
  }

  return value;
}
