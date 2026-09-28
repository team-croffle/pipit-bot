/**
 * Reads one pull request or issue, as it stands right now, for a manual reminder.
 *
 * WHY apart from app-client.ts: that module is about the installation itself (its
 * token, its repositories, its people). This one is about a single item, and keeping
 * them apart keeps both under the size the lint rule allows.
 *
 * WHY `/issues/{n}` first: pull requests and issues share one number space, and the
 * issues endpoint answers for both — a pull request carries a `pull_request` key.
 * Asking `/pulls/{n}` first would make its 404 mean either "no such item" or "that
 * number is an issue", and the reason given to the person would get vaguer.
 *
 * Never cached: the whole point of asking is to see the item as it is now.
 */

import { container } from '@sapphire/framework';

import type { GithubAppConfig } from '../env.js';
import { callGithub, getInstallationToken, GithubResponseError } from './app-client.js';
import { asRecord, readIssueLike, type GithubIssueLike } from './payload-types.js';

/** A pull request as it stands right now. */
export interface PullRequestSnapshot {
  pull: GithubIssueLike;
  state: 'open' | 'closed';
  merged: boolean;
  /**
   * Teams still asked to review, by slug. GitHub keeps them apart from
   * `requested_reviewers`, and there is no team-to-Discord mapping yet (v0.6.7), so
   * they can only be named, never mentioned.
   */
  teams: string[];
}

/** One pull request or issue, as it stands right now. */
export type ItemSnapshot =
  | ({ kind: 'pull' } & PullRequestSnapshot)
  | { kind: 'issue'; issue: GithubIssueLike; state: 'open' | 'closed' };

export type LookupFailure = {
  ok: false;
  reason: 'not-found' | 'forbidden' | 'failed';
  detail: string;
};

export type PullRequestLookup = { ok: true; snapshot: PullRequestSnapshot } | LookupFailure;
export type ItemLookup = { ok: true; snapshot: ItemSnapshot } | LookupFailure;

const UNEXPECTED: LookupFailure = {
  ok: false,
  reason: 'failed',
  detail: 'GitHub returned an unexpected shape.',
};

function readState(row: Record<string, unknown>): 'open' | 'closed' {
  return row.state === 'closed' ? 'closed' : 'open';
}

function readTeams(row: Record<string, unknown>): string[] {
  const teams = row.requested_teams;
  if (!Array.isArray(teams)) {
    return [];
  }

  return teams.flatMap((team) => {
    const slug = asRecord(team)?.slug;
    return typeof slug === 'string' && slug ? [slug] : [];
  });
}

/** Turns a thrown error into the one line the person asking should read. */
function describeFailure(error: unknown, subject: string): LookupFailure {
  if (error instanceof GithubResponseError) {
    // 404 is also what a repository outside the installation answers with.
    if (error.status === 404) {
      return {
        ok: false,
        reason: 'not-found',
        detail: `No such ${subject}, or the GitHub App is not installed on that repository.`,
      };
    }

    if (error.status === 403 || error.status === 401) {
      return {
        ok: false,
        reason: 'forbidden',
        detail:
          'The GitHub App may not read this — approve the Issues (read) and Pull requests (read) permissions.',
      };
    }
  }

  container.logger.warn(`[github] ${subject} lookup failed:`, error);
  return {
    ok: false,
    reason: 'failed',
    detail: error instanceof Error ? error.message : 'GitHub could not be reached.',
  };
}

async function readPull(token: string, repo: string, number: number): Promise<PullRequestLookup> {
  const body = await callGithub<unknown>(`/repos/${repo}/pulls/${number}`, token);
  const pull = readIssueLike(body, true);
  const row = asRecord(body);
  if (!pull || !row) {
    return UNEXPECTED;
  }

  return {
    ok: true,
    snapshot: { pull, state: readState(row), merged: row.merged === true, teams: readTeams(row) },
  };
}

/**
 * Reads one pull request. The REST object names its fields the way the webhook's
 * `pull_request` node does, so the same reader turns it into the notification shape.
 * `requested_reviewers` is the list GitHub trims as reviews land — "who has not
 * reviewed yet" without a second request for the reviews themselves.
 */
export async function fetchPullRequest(
  config: GithubAppConfig,
  repo: string,
  number: number,
): Promise<PullRequestLookup> {
  try {
    return await readPull(await getInstallationToken(config), repo, number);
  } catch (error) {
    return describeFailure(error, 'pull request');
  }
}

/** Reads whichever of the two the number is. */
export async function fetchItem(
  config: GithubAppConfig,
  repo: string,
  number: number,
): Promise<ItemLookup> {
  try {
    const token = await getInstallationToken(config);
    const body = await callGithub<unknown>(`/repos/${repo}/issues/${number}`, token);
    const issue = readIssueLike(body, false);
    const row = asRecord(body);
    if (!issue || !row) {
      return UNEXPECTED;
    }

    if (!issue.isPullRequest) {
      return { ok: true, snapshot: { kind: 'issue', issue, state: readState(row) } };
    }

    // The issue view of a pull request lacks reviewers, draft and merge state.
    const pull = await readPull(token, repo, number);
    return pull.ok ? { ok: true, snapshot: { kind: 'pull', ...pull.snapshot } } : pull;
  } catch (error) {
    return describeFailure(error, 'pull request or issue');
  }
}
