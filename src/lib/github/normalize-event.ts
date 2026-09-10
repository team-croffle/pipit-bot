import {
  asRecord,
  asUser,
  readIssueLike,
  readRepoFullName,
  type GithubIssueLike,
  type GithubUser,
} from './payload-types.js';
import type { GithubEventToggles } from './settings.js';
import { EVENT_LABELS } from './template.js';

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
  /**
   * True when the event exists only to tell somebody something and there is nobody
   * left to tell — an author assigning themself, a reviewer commenting on their own
   * review. Nothing new should be posted for it. It is still produced, because the
   * message that opened the pull request may need updating; whether anything is
   * sent is dispatch's decision, not this module's.
   */
  silent: boolean;
  /**
   * True for an event that only changes what the announcement should say — a
   * conversion to draft, and later a title edit or an unassignment. No toggle governs
   * it and nothing is ever posted for it; dispatch updates the announcement or notes
   * why it could not. `toggle` names the announcement's own event.
   */
  updateOnly?: boolean;
}

interface EventContext {
  action: string;
  repo: string;
  actor: GithubUser;
  payload: Record<string, unknown>;
}

type EventHandler = (context: EventContext) => GithubNotification | undefined;

// Kinds that exist purely to notify a person: with nobody left to mention after
// self-suppression, there is nothing worth posting — the notification is marked
// `silent` rather than dropped, so dispatch can still update an earlier message.
const MENTION_ONLY_TOGGLES = new Set<keyof GithubEventToggles>([
  'pullRequestAssigned',
  'pullRequestReviewRequested',
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
    silent: unique.length === 0 && MENTION_ONLY_TOGGLES.has(toggle),
  };
}

/**
 * `edited` fires for the body as well as the title; `changes.title` is present only
 * when the title moved. The body is not in the announcement, so a body edit is nothing.
 */
function titleChanged(payload: Record<string, unknown>): boolean {
  return asRecord(asRecord(payload.changes)?.title) !== undefined;
}

/** An event with nothing to say of its own: it exists to bring the announcement up to date. */
function updateOnly(
  context: EventContext,
  subject: GithubIssueLike,
  toggle: keyof GithubEventToggles,
  label: string,
): GithubNotification {
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
    targets: [],
    silent: true,
    updateOnly: true,
  };
}

function handlePullRequest(context: EventContext): GithubNotification | undefined {
  const pull = readIssueLike(context.payload.pull_request, true);
  if (!pull) {
    return undefined;
  }

  // A draft is announced when it becomes reviewable, not when it is created: nobody
  // can act on it before, and pinging its reviewers at creation only makes them
  // look at something they were asked not to review yet.
  if ((context.action === 'opened' && !pull.isDraft) || context.action === 'ready_for_review') {
    return build(context, pull, 'pullRequestOpened', EVENT_LABELS.pullRequestOpened, [
      ...(pull.requestedReviewers ?? []),
      ...(pull.assignees ?? []),
    ]);
  }

  if (context.action === 'converted_to_draft') {
    return updateOnly(context, pull, 'pullRequestOpened', 'Converted to Draft');
  }

  // A reopened pull request is news to the same people as an opening, and its
  // announcement becomes the one later assignments update.
  if (context.action === 'reopened') {
    return build(context, pull, 'pullRequestReopened', EVENT_LABELS.pullRequestReopened, [
      ...(pull.requestedReviewers ?? []),
      ...(pull.assignees ?? []),
    ]);
  }

  // Nothing to say, but the announcement's Assignees / Reviewers / title have changed.
  if (context.action === 'unassigned') {
    return updateOnly(context, pull, 'pullRequestOpened', 'Unassigned');
  }

  if (context.action === 'review_request_removed') {
    return updateOnly(context, pull, 'pullRequestOpened', 'Review Request Removed');
  }

  if (context.action === 'edited' && titleChanged(context.payload)) {
    return updateOnly(context, pull, 'pullRequestOpened', 'Title Edited');
  }

  if (context.action === 'synchronize') {
    // WHY: a draft is still being assembled — the commits piling up in one are not
    // news to anybody yet.
    if (pull.isDraft) {
      return undefined;
    }

    return build(context, pull, 'pullRequestUpdated', EVENT_LABELS.pullRequestUpdated, [
      ...(pull.requestedReviewers ?? []),
      ...(pull.assignees ?? []),
    ]);
  }

  if (context.action === 'closed') {
    const merged = asRecord(context.payload.pull_request)?.merged === true;
    const toggle = merged ? 'pullRequestMerged' : 'pullRequestClosed';
    return build(context, pull, toggle, EVENT_LABELS[toggle], [
      pull.user,
      ...(merged ? [] : (pull.requestedReviewers ?? [])),
    ]);
  }

  if (context.action === 'assigned') {
    const assignee = asUser(context.payload.assignee);
    return build(
      context,
      pull,
      'pullRequestAssigned',
      EVENT_LABELS.pullRequestAssigned,
      [assignee],
      assignee,
    );
  }

  if (context.action === 'review_requested') {
    const requested = asUser(context.payload.requested_reviewer);
    // A team request names the team in `requested_team`, not a person. There is no
    // team-to-Discord mapping yet, so nobody is pinged — but the announcement still
    // gets brought up to date, and `{assignee}` reads as the team.
    // WHY not `requested_reviewers` as a fallback: that list is the people already
    // asked, and using it re-pinged every existing reviewer on each team request.
    const team = asRecord(context.payload.requested_team);
    const slug = typeof team?.slug === 'string' ? team.slug : undefined;
    const subject = requested ?? (slug ? { login: `team/${slug}` } : undefined);
    return build(
      context,
      pull,
      'pullRequestReviewRequested',
      EVENT_LABELS.pullRequestReviewRequested,
      requested ? [requested] : [],
      subject,
    );
  }

  return undefined;
}

function handleIssues(context: EventContext): GithubNotification | undefined {
  const issue = readIssueLike(context.payload.issue, false);
  if (!issue) {
    return undefined;
  }

  if (context.action === 'opened') {
    return build(context, issue, 'issueOpened', EVENT_LABELS.issueOpened, issue.assignees ?? []);
  }

  if (context.action === 'assigned') {
    const assignee = asUser(context.payload.assignee);
    return build(context, issue, 'issueAssigned', EVENT_LABELS.issueAssigned, [assignee], assignee);
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
    return build(context, issue, 'issueReopened', EVENT_LABELS.issueReopened, [
      issue.user,
      ...(issue.assignees ?? []),
    ]);
  }

  if (context.action === 'unassigned') {
    return updateOnly(context, issue, 'issueOpened', 'Unassigned');
  }

  if (context.action === 'edited' && titleChanged(context.payload)) {
    return updateOnly(context, issue, 'issueOpened', 'Title Edited');
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

// WHY: a lookup table rather than a switch — oxlint's switch-exhaustiveness-check
// forbids a default case, and these are arbitrary strings off the wire.
//
// WHY `pull_request_review_comment` is not here: every comment on a diff belongs to a
// review, and GitHub reports that review through `pull_request_review.submitted` — a
// single "Add single comment" makes an implicit review and sent both events, so one
// remark arrived twice, and a review with N comments arrived N+1 times. One action,
// one notification: the review carries it.
const HANDLERS: Record<string, EventHandler> = {
  pull_request: handlePullRequest,
  pull_request_review: handlePullRequestReview,
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
