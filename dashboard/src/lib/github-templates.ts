import { t } from '@/i18n';
import type { EmbedTemplate, GithubEventKey, GithubEventToggles } from '@/types';

type EventGroup = 'pr' | 'issue' | 'common';

interface EventLabel {
  key: GithubEventKey;
  /** Read at render time, so a change of language shows. */
  readonly label: string;
  group: EventGroup;
  /** Starts checked — a permission switch rather than a notification. */
  defaultOn?: boolean;
}

function entry(key: GithubEventKey, group: EventGroup, defaultOn?: true): EventLabel {
  return {
    key,
    group,
    ...(defaultOn ? { defaultOn } : {}),
    get label() {
      return t(`github.events.${key}`);
    },
  };
}

/** A pull request's life, then an issue's — the order the server lists them in. */
export const eventLabels: EventLabel[] = [
  entry('pullRequestOpened', 'pr'),
  entry('pullRequestUpdated', 'pr'),
  entry('pullRequestAssigned', 'pr'),
  entry('pullRequestReviewRequested', 'pr'),
  entry('pullRequestChangesRequested', 'pr'),
  entry('pullRequestApproved', 'pr'),
  entry('pullRequestMerged', 'pr'),
  entry('pullRequestClosed', 'pr'),
  entry('pullRequestReopened', 'pr'),
  entry('pullRequestReminded', 'pr', true),
  entry('issueOpened', 'issue'),
  entry('issueAssigned', 'issue'),
  entry('issueResolved', 'issue'),
  entry('issueClosed', 'issue'),
  entry('issueReopened', 'issue'),
  entry('issueReminded', 'issue', true),
  entry('commentCreated', 'common'),
];

/**
 * `{actor}` is a different person on every event, and that ambiguity is what made
 * "the merger" render as the assignee. The variable stays one name; the editor spells
 * out who it will be for the event being edited.
 */
export function actorLabel(key: GithubEventKey): string {
  return t(`github.actors.${key}`);
}

const HINTED_VARIABLES = new Set([
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
]);

/** What a template variable stands for, or '' for one without a hint. */
export function variableHint(name: string): string {
  return HINTED_VARIABLES.has(name) ? t(`github.variables.${name}`) : '';
}

/**
 * Sample values for the preview — shaped like what the bot actually substitutes.
 *
 * `{event}` and the subject vary per event: with one fixed set, every row in the
 * summary table rendered the same sentence, which made the table useless for telling
 * the events apart.
 */
function baseSample(): Record<string, string> {
  return {
    repo: 'team-croffle/pipit-bot',
    pr_number: '42',
    actor: t('github.sample.actor'),
    author: t('github.sample.author'),
    assignee: t('github.sample.assignee'),
    assignees: t('github.sample.assignee'),
    reviewers: t('github.sample.reviewer'),
    mentions: t('github.sample.assignee'),
  };
}

function pullSample(): Record<string, string> {
  return {
    pr_url: 'https://github.com/team-croffle/pipit-bot/pull/42',
    pr_title: t('github.sample.pullTitle'),
  };
}

function issueSample(): Record<string, string> {
  return {
    pr_url: 'https://github.com/team-croffle/pipit-bot/issues/42',
    pr_title: t('github.sample.issueTitle'),
  };
}

/** Who `{actor}` is, phrased short enough for a sample value (keys of `github.sample`). */
const ACTOR_SAMPLE: Partial<Record<GithubEventKey, string>> = {
  pullRequestOpened: 'opener',
  pullRequestUpdated: 'pusher',
  pullRequestAssigned: 'assigner',
  pullRequestReviewRequested: 'requester',
  pullRequestChangesRequested: 'reviewer',
  pullRequestApproved: 'reviewer',
  pullRequestMerged: 'merger',
  pullRequestClosed: 'closer',
  pullRequestReopened: 'reopener',
  pullRequestReminded: 'author',
  issueOpened: 'opener',
  issueAssigned: 'assigner',
  issueResolved: 'resolver',
  issueClosed: 'closer',
  issueReopened: 'reopener',
  issueReminded: 'author',
  commentCreated: 'author',
};

// Mirrors renderTemplate on the bot: `{name}`, `{name|tail}`, `{name|tail|fallback}`,
// with `{}` inside a branch marking where the value goes. Kept in step by hand — the
// preview is the only thing that needs it, and shipping a parser to the browser just
// to draw one card is not worth an endpoint round trip per keystroke.
const PLACEHOLDER = /\{([a-z_]+)((?:\|(?:[^{}|]|\{\})*){0,2})\}/g;
const VALUE_SLOT = '{}';

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template
    .replaceAll(PLACEHOLDER, (whole, name: string, tail: string) => {
      if (!(name in values)) {
        return whole;
      }

      const value = values[name] ?? '';
      const branches = tail ? tail.slice(1).split('|') : [];
      if (value) {
        if (branches.length === 0) {
          return value;
        }

        const branch = branches[0] ?? '';
        return branch.includes(VALUE_SLOT)
          ? branch.replaceAll(VALUE_SLOT, value)
          : `${value}${branch}`;
      }

      return branches.length > 1 ? (branches[1] ?? '') : '';
    })
    .trim();
}

/** Only the variables this event can fill, so the preview matches what will be sent. */
export function sampleFor(
  event: GithubEventKey,
  allowed: string[],
  label: string,
): Record<string, string> {
  const subject = event.startsWith('issue') ? issueSample() : pullSample();
  const base = baseSample();
  const actor = ACTOR_SAMPLE[event];
  const values: Record<string, string> = {
    ...base,
    ...subject,
    event: label,
    actor: actor ? t(`github.sample.${actor}`) : (base.actor ?? ''),
  };

  return Object.fromEntries(allowed.map((name) => [name, values[name] ?? '']));
}

export function emptyTemplate(): EmbedTemplate {
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

export function cloneTemplate(template: EmbedTemplate): EmbedTemplate {
  return { ...template, fields: template.fields.map((field) => ({ ...field })) };
}

/** The label list folded into its groups, for rendering twelve checkboxes readably. */
export const eventGroups: { key: EventGroup; readonly name: string; events: EventLabel[] }[] = [
  ...new Set(eventLabels.map((item) => item.group)),
].map((key) => ({
  key,
  get name() {
    return t(`github.groups.${key}`);
  },
  events: eventLabels.filter((item) => item.group === key),
}));

/** Derived from the label list, so a new event cannot be missed here. */
export function emptyToggles(): GithubEventToggles {
  return Object.fromEntries(
    eventLabels.map((item) => [item.key, item.defaultOn === true]),
  ) as unknown as GithubEventToggles;
}
