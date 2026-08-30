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
  author?: string;
  /** Roles as the payload states them — no self-suppression, so a template can
   *  still say "updated by <the person who is also the assignee>". */
  assignees: string[];
  reviewers: string[];
  /** The one person an assign/review-request event is about, when it names one. */
  assignee?: string;
  /** Who is worth pinging: the roles this event is about, minus the actor. */
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
  'pullRequestChangesRequested',
  'pullRequestApproved',
  'commentCreated',
]);

/**
 * A review carries its outcome in `state`, and the three outcomes are different news.
 *
 * WHY `commented` lands on commentCreated rather than a toggle of its own: a review
 * left without approving or requesting changes is a comment, and that is where an
 * operator looks for it. A thirteenth switch would only split the same idea in two.
 */
const REVIEW_OUTCOMES: Record<string, { toggle: keyof GithubEventToggles; label: string }> = {
  approved: { toggle: 'pullRequestApproved', label: 'Approved' },
  changes_requested: { toggle: 'pullRequestChangesRequested', label: 'Changes Requested' },
  commented: { toggle: 'commentCreated', label: 'Reviewed' },
};

/**
 * Which way an issue was closed.
 *
 * `state_reason` is what the "Close as completed" / "Close as not planned" buttons
 * set. It is absent on payloads old enough to predate the distinction, and those read
 * as a plain close rather than as a resolution — claiming something was resolved is
 * the worse guess of the two.
 */
const CLOSE_OUTCOMES: Record<string, { toggle: keyof GithubEventToggles; label: string }> = {
  completed: { toggle: 'issueResolved', label: 'Issue Resolved' },
  not_planned: { toggle: 'issueClosed', label: 'Issue Closed' },
  duplicate: { toggle: 'issueClosed', label: 'Issue Closed' },
};

function logins(users: GithubUser[] | undefined): string[] {
  const unique: string[] = [];
  for (const user of users ?? []) {
    if (!unique.some((item) => item.toLowerCase() === user.login.toLowerCase())) {
      unique.push(user.login);
    }
  }

  return unique;
}

function build(
  context: EventContext,
  subject: GithubIssueLike,
  toggle: keyof GithubEventToggles,
  label: string,
  targets: (GithubUser | undefined)[],
  assignee?: GithubUser,
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
    author: subject.user?.login,
    assignees: logins(subject.assignees),
    reviewers: logins(subject.requestedReviewers),
    assignee: assignee?.login,
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

  if (context.action === 'synchronize') {
    // WHY: a draft is still being assembled — the commits piling up in one are not
    // news to anybody yet.
    if (pull.isDraft) {
      return undefined;
    }

    return build(context, pull, 'pullRequestUpdated', 'PR Updated', [
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
    const assignee = asUser(context.payload.assignee);
    return build(context, pull, 'pullRequestAssigned', 'PR Assigned', [assignee], assignee);
  }

  if (context.action === 'review_requested') {
    const requested = asUser(context.payload.requested_reviewer);
    const team = requested ? [requested] : asUserList(context.payload.requested_reviewers);
    return build(context, pull, 'pullRequestAssigned', 'Review Requested', team, requested);
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
    const assignee = asUser(context.payload.assignee);
    return build(context, issue, 'issueAssigned', 'Issue Assigned', [assignee], assignee);
  }

  if (context.action === 'closed') {
    const reason = asRecord(context.payload.issue)?.state_reason;
    const outcome =
      (typeof reason === 'string' ? CLOSE_OUTCOMES[reason] : undefined) ??
      CLOSE_OUTCOMES.not_planned;
    return build(context, issue, outcome.toggle, outcome.label, [
      issue.user,
      ...(issue.assignees ?? []),
    ]);
  }

  if (context.action === 'reopened') {
    return build(context, issue, 'issueReopened', 'Issue Reopened', [
      issue.user,
      ...(issue.assignees ?? []),
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

  const outcome = REVIEW_OUTCOMES[state.toLowerCase()];
  if (!outcome) {
    return undefined;
  }

  return build(context, pull, outcome.toggle, outcome.label, [pull.user]);
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
