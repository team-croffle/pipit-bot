/**
 * The wording a fresh install starts from.
 *
 * WHY one default per event rather than one shared default: the whole point of
 * `EVENT_VARIABLES` is that events carry different people. A single template has to
 * pick the vaguest wording that works everywhere, which is how "merged by" ended up
 * showing the assignee. Each event names the person it is actually about.
 *
 * The labels stay in English to match `{event}` ("PR Open", "PR Merged"), which the
 * webhook layer produces.
 */

import { emptyEmbedTemplate, type EmbedTemplate } from './embed-template.js';
import type { GithubEventKey } from './template.js';

/**
 * The single shared wording v0.6.2 shipped with. Kept only so a file that still
 * carries it can be told apart from one an operator customised — an untouched base
 * is dropped in favour of the per-event defaults below, a customised one is not.
 */
export const LEGACY_DEFAULT_TEMPLATE =
  '**{event}** · `{repo}` [#{pr_number}]({pr_url}) — {pr_title}\n{mentions}';

const FOOTER = '{repo} #{pr_number}';

// A field renders as "—" rather than vanishing, so an inline pair keeps its columns.
const REVIEWERS = { name: 'Reviewers', value: '{reviewers|{}|—}', inline: true };
const ASSIGNEES = { name: 'Assignees', value: '{assignees|{}|—}', inline: true };

function template(color: string, fields: EmbedTemplate['fields']): EmbedTemplate {
  return {
    ...emptyEmbedTemplate(),
    content: '{mentions}',
    title: '{event} · {pr_title}',
    fields,
    footer: FOOTER,
    color,
    showTimestamp: true,
  };
}

export const DEFAULT_EVENT_TEMPLATES: Record<GithubEventKey, EmbedTemplate> = {
  pullRequestOpened: template('#22c55e', [
    { name: 'Opened by', value: '{actor}', inline: true },
    REVIEWERS,
    ASSIGNEES,
  ]),
  pullRequestUpdated: template('#3b82f6', [
    { name: 'Pushed by', value: '{actor}', inline: true },
    REVIEWERS,
    ASSIGNEES,
  ]),
  // `{actor}` is the person who pressed merge; `{author}` wrote the pull request.
  pullRequestMerged: template('#8b5cf6', [
    { name: 'Merged by', value: '{actor}', inline: true },
    { name: 'Author', value: '{author|{}|—}', inline: true },
    ASSIGNEES,
  ]),
  pullRequestAssigned: template('#f59e0b', [
    { name: 'Assigned', value: '{assignee|{}|—}', inline: true },
    { name: 'Requested by', value: '{actor}', inline: true },
  ]),
  // `{reviewers}` is the outstanding request list, which GitHub empties the moment
  // the review lands — the reviewer is `{actor}`.
  pullRequestChangesRequested: template('#ef4444', [
    { name: 'Reviewer', value: '{actor}', inline: true },
    { name: 'Author', value: '{author|{}|—}', inline: true },
  ]),
  pullRequestApproved: template('#06b6d4', [
    { name: 'Reviewer', value: '{actor}', inline: true },
    { name: 'Author', value: '{author|{}|—}', inline: true },
  ]),
  issueOpened: template('#22c55e', [
    { name: 'Opened by', value: '{actor}', inline: true },
    ASSIGNEES,
  ]),
  issueAssigned: template('#f59e0b', [
    { name: 'Assigned', value: '{assignee|{}|—}', inline: true },
    { name: 'Assigned by', value: '{actor}', inline: true },
  ]),
  issueResolved: template('#8b5cf6', [
    { name: 'Resolved by', value: '{actor}', inline: true },
    { name: 'Author', value: '{author|{}|—}', inline: true },
  ]),
  issueClosed: template('#64748b', [
    { name: 'Closed by', value: '{actor}', inline: true },
    { name: 'Author', value: '{author|{}|—}', inline: true },
  ]),
  issueReopened: template('#22c55e', [
    { name: 'Reopened by', value: '{actor}', inline: true },
    ASSIGNEES,
  ]),
  commentCreated: template('#64748b', [
    { name: 'Comment by', value: '{actor}', inline: true },
    { name: 'Author', value: '{author|{}|—}', inline: true },
  ]),
};

export function defaultTemplateFor(event: GithubEventKey): EmbedTemplate {
  return structuredClone(DEFAULT_EVENT_TEMPLATES[event]);
}
