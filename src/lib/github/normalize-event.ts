import {
  asRecord,
  asUser,
  asUserList,
  readIssueLike,
  readRepoFullName,
  type GithubIssueLike,
  type GithubUser,
} from './payload-types.js';
import type { GithubEventToggles } from './settings.js';

export interface GithubNotification {
  toggle: keyof GithubEventToggles;
  label: string;
  repo: string;
  number: number;
  title: string;
  isPullRequest: boolean;
  actor: string;
  targets: string[];
}

interface EventContext {
  action: string;
  repo: string;
  actor: GithubUser;
  payload: Record<string, unknown>;
}

type EventHandler = (context: EventContext) => GithubNotification | undefined;

// Kinds that exist purely to notify a person: with nobody left to mention after
// self-suppression, there is nothing worth posting.
const MENTION_ONLY_TOGGLES = new Set<keyof GithubEventToggles>([
  'pullRequestAssigned',
  'issueAssigned',
  'reviewSubmitted',
  'commentCreated',
]);

const REVIEW_LABELS: Record<string, string> = {
  approved: 'Approved',
  changes_requested: 'Changes Requested',
  commented: 'Reviewed',
};

function build(
  context: EventContext,
  subject: GithubIssueLike,
  toggle: keyof GithubEventToggles,
  label: string,
  targets: (GithubUser | undefined)[],
): GithubNotification | undefined {
  const actor = context.actor.login.toLowerCase();
  const unique: string[] = [];
  for (const user of targets) {
    if (!user) {
      continue;
    }

    const login = user.login;
    if (login.toLowerCase() === actor) {
      continue;
    }

    if (!unique.some((item) => item.toLowerCase() === login.toLowerCase())) {
      unique.push(login);
    }
  }

  if (unique.length === 0 && MENTION_ONLY_TOGGLES.has(toggle)) {
    return undefined;
  }

  return {
    toggle,
    label,
    repo: context.repo,
    number: subject.number,
    title: subject.title,
    isPullRequest: subject.isPullRequest,
    actor: context.actor.login,
    targets: unique,
  };
}

function handlePullRequest(context: EventContext): GithubNotification | undefined {
  const pull = readIssueLike(context.payload.pull_request, true);
  if (!pull) {
    return undefined;
  }

  if (context.action === 'opened') {
    return build(context, pull, 'pullRequestOpened', 'PR Open', [
      ...(pull.requestedReviewers ?? []),
      ...(pull.assignees ?? []),
    ]);
  }

  if (context.action === 'closed') {
    const merged = asRecord(context.payload.pull_request)?.merged;
    if (merged !== true) {
      return undefined;
    }

    return build(context, pull, 'pullRequestMerged', 'PR Merged', [pull.user]);
  }

  if (context.action === 'assigned') {
    return build(context, pull, 'pullRequestAssigned', 'PR Assigned', [
      asUser(context.payload.assignee),
    ]);
  }

  if (context.action === 'review_requested') {
    const requested = asUser(context.payload.requested_reviewer);
    const team = requested ? [requested] : asUserList(context.payload.requested_reviewers);
    return build(context, pull, 'pullRequestAssigned', 'Review Requested', team);
  }

  return undefined;
}

function handleIssues(context: EventContext): GithubNotification | undefined {
  const issue = readIssueLike(context.payload.issue, false);
  if (!issue) {
    return undefined;
  }

  if (context.action === 'opened') {
    return build(context, issue, 'issueOpened', 'Issue Open', issue.assignees ?? []);
  }

  if (context.action === 'assigned') {
    return build(context, issue, 'issueAssigned', 'Issue Assigned', [
      asUser(context.payload.assignee),
    ]);
  }

  return undefined;
}

function handlePullRequestReview(context: EventContext): GithubNotification | undefined {
  if (context.action !== 'submitted') {
    return undefined;
  }

  const pull = readIssueLike(context.payload.pull_request, true);
  const state = asRecord(context.payload.review)?.state;
  if (!pull || typeof state !== 'string') {
    return undefined;
  }

  const label = REVIEW_LABELS[state.toLowerCase()];
  if (!label) {
    return undefined;
  }

  return build(context, pull, 'reviewSubmitted', label, [pull.user]);
}

function handleIssueComment(context: EventContext): GithubNotification | undefined {
  if (context.action !== 'created') {
    return undefined;
  }

  const issue = readIssueLike(context.payload.issue, false);
  if (!issue) {
    return undefined;
  }

  return build(context, issue, 'commentCreated', issue.isPullRequest ? 'PR Comment' : 'Comment', [
    issue.user,
  ]);
}

function handleReviewComment(context: EventContext): GithubNotification | undefined {
  if (context.action !== 'created') {
    return undefined;
  }

  const pull = readIssueLike(context.payload.pull_request, true);
  if (!pull) {
    return undefined;
  }

  return build(context, pull, 'commentCreated', 'Review Comment', [pull.user]);
}

// WHY: a lookup table rather than a switch — oxlint's switch-exhaustiveness-check
// forbids a default case, and these are arbitrary strings off the wire.
const HANDLERS: Record<string, EventHandler> = {
  pull_request: handlePullRequest,
  pull_request_review: handlePullRequestReview,
  pull_request_review_comment: handleReviewComment,
  issue_comment: handleIssueComment,
  issues: handleIssues,
};

function isBot(user: GithubUser): boolean {
  return user.type === 'Bot' || user.login.toLowerCase().endsWith('[bot]');
}

/** Returns undefined for any event/action this bot does not report on. */
export function normalizeGithubEvent(
  eventName: string,
  payload: unknown,
): GithubNotification | undefined {
  const handler = HANDLERS[eventName];
  const body = asRecord(payload);
  if (!handler || !body) {
    return undefined;
  }

  const actor = asUser(body.sender);
  const repo = readRepoFullName(body);
  if (!actor || !repo || typeof body.action !== 'string') {
    return undefined;
  }

  // WHY: keeps CI and dependency bots from flooding the channel, and stops any
  // feedback loop where an automation reacts to its own activity.
  if (isBot(actor)) {
    return undefined;
  }

  return handler({ action: body.action, repo, actor, payload: body });
}
