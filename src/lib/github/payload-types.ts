// Structural types for only the payload fields this bot reads. Hand-written rather
// than pulling in a webhook types package for six shapes.

export interface GithubUser {
  login: string;
  type?: string;
}

export interface GithubIssueLike {
  number: number;
  title: string;
  user?: GithubUser;
  assignees?: GithubUser[];
  requestedReviewers?: GithubUser[];
  isPullRequest: boolean;
  isDraft: boolean;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

export function asUser(value: unknown): GithubUser | undefined {
  const row = asRecord(value);
  if (!row || typeof row.login !== 'string' || !row.login) {
    return undefined;
  }

  return { login: row.login, type: typeof row.type === 'string' ? row.type : undefined };
}

export function asUserList(value: unknown): GithubUser[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const user = asUser(item);
    return user ? [user] : [];
  });
}

export function readRepoFullName(payload: Record<string, unknown>): string | undefined {
  const repository = asRecord(payload.repository);
  const fullName = repository?.full_name;
  return typeof fullName === 'string' && fullName ? fullName.toLowerCase() : undefined;
}

/** Reads a `pull_request` or `issue` node into one shape. */
export function readIssueLike(
  value: unknown,
  forcePullRequest: boolean,
): GithubIssueLike | undefined {
  const row = asRecord(value);
  if (!row || !Number.isInteger(row.number) || typeof row.title !== 'string') {
    return undefined;
  }

  return {
    number: row.number as number,
    title: row.title,
    user: asUser(row.user),
    assignees: asUserList(row.assignees),
    requestedReviewers: asUserList(row.requested_reviewers),
    isPullRequest: forcePullRequest || asRecord(row.pull_request) !== undefined,
    isDraft: row.draft === true,
  };
}
