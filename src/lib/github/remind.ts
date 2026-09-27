/**
 * A reminder for one pull request, asked for by a person.
 *
 * WHY this exists: every notification so far is a reaction to a webhook. A pull
 * request that has sat unreviewed for three days sends no event, so nothing nudges
 * the reviewers. This reads the pull request as it stands and posts the nudge
 * through the same path a webhook would take — same channel rule, same wording
 * tables, same delivery record — so the operator finds it where everything else is.
 *
 * Shared by the `!pr` command and the dashboard; both hand in a repository and a
 * number and get one verdict back.
 */

import { container } from '@sapphire/framework';

import { fetchPullRequest, type PullRequestSnapshot } from './app-client.js';
import { recordDelivery, type DeliveryOutcome } from './delivery-log.js';
import { dispatchGithubNotification } from './dispatch.js';
import type { GithubNotification } from './normalize-event.js';
import { getGithubNotifySettings } from './settings.js';
import { EVENT_LABELS } from './template.js';

export interface PullRequestReference {
  /** Lower-cased `owner/name`. */
  repo: string;
  number: number;
}

export interface ReminderResult {
  outcome: DeliveryOutcome;
  detail?: string;
  /** Where the reminder was posted, when it was. */
  channelId?: string;
  /** How many people the reminder set out to mention. */
  targets: number;
}

const LABEL = EVENT_LABELS.pullRequestReminded;
const TOGGLE = 'pullRequestReminded';
// One reminder per pull request per five minutes. In memory: it exists to stop a
// key being leaned on, not to keep a history, and a restart forgetting it is fine.
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

/** Why an open pull request should not be reminded about, or undefined when it should. */
function notWorthReminding(snapshot: PullRequestSnapshot): string | undefined {
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

/**
 * The reminder as a notification: the author is its actor, and everyone still on
 * the pull request except the author is worth pinging. `requested_reviewers` is the
 * list GitHub trims as reviews land, so it already excludes people who reviewed.
 */
function asNotification(
  reference: PullRequestReference,
  snapshot: PullRequestSnapshot,
): GithubNotification {
  const { pull } = snapshot;
  const author = pull.user?.login ?? '';
  const reviewers = (pull.requestedReviewers ?? []).map((user) => user.login);
  const assignees = (pull.assignees ?? []).map((user) => user.login);

  const seen = new Set<string>([author.toLowerCase()]);
  const targets: string[] = [];
  for (const login of [...reviewers, ...assignees]) {
    if (!seen.has(login.toLowerCase())) {
      seen.add(login.toLowerCase());
      targets.push(login);
    }
  }

  return {
    toggle: TOGGLE,
    label: LABEL,
    repo: reference.repo,
    number: reference.number,
    title: pull.title,
    isPullRequest: true,
    actor: author,
    author: pull.user?.login,
    assignees,
    reviewers,
    targets,
    silent: targets.length === 0,
    manual: true,
  };
}

export async function remindPullRequest(reference: PullRequestReference): Promise<ReminderResult> {
  // Recorded like a webhook's verdict, so the dashboard's recent deliveries explain
  // a reminder that did not go out the same way they explain any other silence.
  const verdict = (outcome: DeliveryOutcome, detail: string): ReminderResult => {
    recordDelivery(reference.repo, LABEL, outcome, detail);
    return { outcome, detail, targets: 0 };
  };
  const skip = (detail: string): ReminderResult => verdict('skipped', detail);

  if (!getGithubNotifySettings().enabled) {
    return { outcome: 'skipped', detail: 'GitHub notifications are switched off.', targets: 0 };
  }

  const config = container.config.githubApp;
  if (!config) {
    return skip(
      'The bot has no GitHub App credentials, so it cannot read the pull request. Set GITHUB_APP_ID and the private key.',
    );
  }

  const left = cooldownLeft(reference);
  if (left > 0) {
    return skip(
      `This pull request was reminded about a moment ago — try again in ${Math.ceil(left / 60)} minute(s).`,
    );
  }

  const lookup = await fetchPullRequest(config, reference.repo, reference.number);
  if (!lookup.ok) {
    return verdict(lookup.reason === 'failed' ? 'failed' : 'skipped', lookup.detail);
  }

  const reason = notWorthReminding(lookup.snapshot);
  if (reason) {
    return skip(reason);
  }

  const notification = asNotification(reference, lookup.snapshot);
  if (notification.targets.length === 0) {
    return skip('Nobody is waiting on this pull request: no pending reviewers and no assignees.');
  }

  const result = await dispatchGithubNotification(notification);
  if (result.outcome === 'sent') {
    lastSent.set(keyFor(reference), Date.now());
  }

  return {
    outcome: result.outcome,
    detail: result.detail,
    channelId: result.channelId,
    targets: notification.targets.length,
  };
}
