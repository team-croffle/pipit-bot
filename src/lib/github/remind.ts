/**
 * A reminder for one pull request or issue, asked for by a person.
 *
 * WHY this exists: every notification so far is a reaction to a webhook. A pull
 * request that has sat unreviewed for three days sends no event, so nothing nudges
 * the reviewers. This reads the item as it stands and posts the nudge through the
 * same path a webhook would take — same channel rule, same wording tables, same
 * delivery record — so the operator finds it where everything else is.
 *
 * A pull request waits on its pending reviewers and its assignees; an issue, which
 * has no reviewers, on its assignees. The author is never pinged: they are the one
 * waiting. Pull requests and issues share one number space, so the caller only
 * hands in a repository and a number and the lookup says which it is.
 *
 * Shared by the reminder command and the dashboard; both get one verdict back.
 */

import { container } from '@sapphire/framework';

import { recordDelivery, type DeliveryOutcome } from './delivery-log.js';
import { dispatchGithubNotification } from './dispatch.js';
import { fetchItem, type ItemSnapshot } from './item-lookup.js';
import type { GithubNotification } from './normalize-event.js';
import type { GithubIssueLike } from './payload-types.js';
import { getGithubNotifySettings } from './settings.js';
import { EVENT_LABELS } from './template.js';

export interface PullRequestReference {
  /** Lower-cased `owner/name`. */
  repo: string;
  number: number;
}

export type ItemKind = 'pull' | 'issue';

export interface ReminderResult {
  outcome: DeliveryOutcome;
  detail?: string;
  /** Which of the two the number turned out to be, once it was read. */
  kind?: ItemKind;
  /** Where the reminder was posted, when it was. */
  channelId?: string;
  /** How many people the reminder set out to mention. */
  targets: number;
}

const TOGGLES = { pull: 'pullRequestReminded', issue: 'issueReminded' } as const;
// Before the lookup the kind is not known yet; the delivery record still needs a label.
const GENERIC_LABEL = 'Reminder';
// One reminder per number per five minutes. In memory: it exists to stop a key being
// leaned on, not to keep a history, and a restart forgetting it is fine.
const COOLDOWN_MS = 5 * 60 * 1000;
const lastSent = new Map<string, number>();

const REPO_NAME = /^[\w.-]{1,100}\/[\w.-]{1,100}$/;
// `owner/name #12`, `owner/name 12`, or the pull request's own URL.
const REFERENCE = /^([\w.-]+\/[\w.-]+)\s+#?(\d{1,9})$/;
const URL_REFERENCE =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d{1,9})(?:[/?#].*)?$/i;

/**
 * Reads the three spellings a person might use. Returns undefined for anything else,
 * including a repository name that could not be part of a URL — the name goes into
 * the API path, so only the characters GitHub itself allows get through.
 */
export function parsePullRequestReference(text: string): PullRequestReference | undefined {
  const trimmed = text.trim();
  const match = URL_REFERENCE.exec(trimmed) ?? REFERENCE.exec(trimmed);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }

  const repo = match[1].toLowerCase();
  const number = Number(match[2]);
  if (!REPO_NAME.test(repo) || !Number.isSafeInteger(number) || number < 1) {
    return undefined;
  }

  return { repo, number };
}

function keyFor(reference: PullRequestReference): string {
  return `${reference.repo}#${reference.number}`;
}

/** Seconds left on the cooldown, or 0 when a reminder may go now. */
function cooldownLeft(reference: PullRequestReference): number {
  const at = lastSent.get(keyFor(reference));
  if (at === undefined) {
    return 0;
  }

  return Math.max(0, Math.ceil((at + COOLDOWN_MS - Date.now()) / 1000));
}

/** Why the item should not be reminded about, or undefined when it should. */
function notWorthReminding(snapshot: ItemSnapshot): string | undefined {
  if (snapshot.kind === 'issue') {
    return snapshot.state === 'closed' ? 'This issue is closed.' : undefined;
  }

  if (snapshot.merged) {
    return 'This pull request has already been merged.';
  }

  if (snapshot.state === 'closed') {
    return 'This pull request is closed.';
  }

  if (snapshot.pull.isDraft) {
    return 'This pull request is still a draft — nobody has been asked to review it yet.';
  }

  return undefined;
}

/** The people worth pinging, in order, each once, never the author. */
function waitingOn(author: string, groups: string[][]): string[] {
  const seen = new Set<string>([author.toLowerCase()]);
  const targets: string[] = [];
  for (const login of groups.flat()) {
    if (!seen.has(login.toLowerCase())) {
      seen.add(login.toLowerCase());
      targets.push(login);
    }
  }

  return targets;
}

/**
 * The reminder as a notification: the author is its actor. `requested_reviewers` is
 * the list GitHub trims as reviews land, so it already excludes people who reviewed.
 */
function asNotification(
  reference: PullRequestReference,
  snapshot: ItemSnapshot,
): GithubNotification {
  const item: GithubIssueLike = snapshot.kind === 'pull' ? snapshot.pull : snapshot.issue;
  const author = item.user?.login ?? '';
  const reviewers =
    snapshot.kind === 'pull' ? (item.requestedReviewers ?? []).map((user) => user.login) : [];
  const assignees = (item.assignees ?? []).map((user) => user.login);
  const targets = waitingOn(author, [reviewers, assignees]);
  const toggle = TOGGLES[snapshot.kind];

  return {
    toggle,
    label: EVENT_LABELS[toggle],
    repo: reference.repo,
    number: reference.number,
    title: item.title,
    isPullRequest: snapshot.kind === 'pull',
    actor: author,
    author: item.user?.login,
    assignees,
    reviewers,
    targets,
    silent: targets.length === 0,
    manual: true,
  };
}

/** Why nobody is pinged — teams are named, since they cannot be mentioned yet. */
function nobodyWaiting(snapshot: ItemSnapshot): string {
  if (snapshot.kind === 'issue') {
    return 'Nobody is waiting on this issue: it has no assignees besides its author.';
  }

  if (snapshot.teams.length > 0) {
    return `Only teams are waiting on this pull request (${snapshot.teams.join(', ')}); teams have no Discord mapping yet, so nobody can be mentioned.`;
  }

  return 'Nobody is waiting on this pull request: no pending reviewers and no assignees.';
}

/**
 * A finished item — merged, or closed — has nobody left to nudge, but the message that
 * announced it may still show an old title or old assignees. It is brought up to date
 * and nothing new is posted. Nobody is pinged, so no cooldown applies either way.
 */
async function refreshAnnouncement(
  reference: PullRequestReference,
  snapshot: ItemSnapshot,
  reason: string,
): Promise<ReminderResult> {
  const notification: GithubNotification = {
    ...asNotification(reference, snapshot),
    // The announcement's own event; the tracked message is re-rendered with its wording.
    toggle: snapshot.kind === 'pull' ? 'pullRequestOpened' : 'issueOpened',
    targets: [],
    silent: true,
    updateOnly: true,
    note: reason,
  };

  const result = await dispatchGithubNotification(notification);
  return { outcome: result.outcome, detail: result.detail, kind: snapshot.kind, targets: 0 };
}

export async function remindItem(reference: PullRequestReference): Promise<ReminderResult> {
  // Recorded like a webhook's verdict, so the dashboard's recent deliveries explain
  // a reminder that did not go out the same way they explain any other silence.
  const verdict = (outcome: DeliveryOutcome, detail: string, kind?: ItemKind): ReminderResult => {
    recordDelivery(
      reference.repo,
      kind ? EVENT_LABELS[TOGGLES[kind]] : GENERIC_LABEL,
      outcome,
      detail,
    );
    return { outcome, detail, kind, targets: 0 };
  };

  if (!getGithubNotifySettings().enabled) {
    return { outcome: 'skipped', detail: 'GitHub notifications are switched off.', targets: 0 };
  }

  const config = container.config.githubApp;
  if (!config) {
    return verdict(
      'skipped',
      'The bot has no GitHub App credentials, so it cannot read the item. Set GITHUB_APP_ID and the private key.',
    );
  }

  const left = cooldownLeft(reference);
  if (left > 0) {
    return verdict(
      'skipped',
      `#${reference.number} was reminded about a moment ago — try again in ${Math.ceil(left / 60)} minute(s).`,
    );
  }

  const lookup = await fetchItem(config, reference.repo, reference.number);
  if (!lookup.ok) {
    return verdict(lookup.reason === 'failed' ? 'failed' : 'skipped', lookup.detail);
  }

  const { snapshot } = lookup;
  const reason = notWorthReminding(snapshot);
  if (reason && snapshot.state === 'closed') {
    return refreshAnnouncement(reference, snapshot, reason);
  }

  if (reason) {
    return verdict('skipped', reason, snapshot.kind);
  }

  const notification = asNotification(reference, snapshot);
  if (notification.targets.length === 0) {
    return verdict('skipped', nobodyWaiting(snapshot), snapshot.kind);
  }

  const result = await dispatchGithubNotification(notification);
  if (result.outcome === 'sent') {
    lastSent.set(keyFor(reference), Date.now());
  }

  // The people were pinged; the teams alongside them can only be named.
  const teams =
    snapshot.kind === 'pull' && snapshot.teams.length > 0
      ? `Teams not mentioned (no Discord mapping yet): ${snapshot.teams.join(', ')}.`
      : undefined;

  return {
    outcome: result.outcome,
    detail: [result.detail, teams].filter(Boolean).join(' ') || undefined,
    kind: snapshot.kind,
    channelId: result.channelId,
    targets: notification.targets.length,
  };
}
