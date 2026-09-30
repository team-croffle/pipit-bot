import type { GithubAppConfig } from '../env.js';
import { callGithub, getInstallationToken } from './app-client.js';
import { asRecord } from './payload-types.js';

/**
 * The open pull requests and issues of one repository, for the dashboard's number
 * picker. Read through the issues endpoint, which lists both in one page and marks a
 * pull request with a `pull_request` key.
 */
export interface GithubOpenItem {
  number: number;
  title: string;
  kind: 'pull' | 'issue';
  draft: boolean;
}

export interface GithubOpenItemList {
  items: GithubOpenItem[];
  /** True when the repository has more open items than one page holds. */
  truncated: boolean;
}

// One page is enough for a picker; a repository past this needs the number typed.
const PER_PAGE = 100;
const MAX_TITLE = 200;
// Short: the list is only as good as the moment it is read, and a reminder is sent
// about what a person just saw.
const CACHE_TTL_MS = 60 * 1000;

const cache = new Map<string, { value: GithubOpenItemList; at: number }>();

function readItem(row: unknown): GithubOpenItem | undefined {
  const record = asRecord(row);
  const number = record?.number;
  const title = record?.title;
  if (typeof number !== 'number' || typeof title !== 'string') {
    return undefined;
  }

  const isPull = asRecord(record?.pull_request) !== undefined;
  return {
    number,
    // The picker renders text, not Discord markdown — only the length is bounded.
    title: title.trim().slice(0, MAX_TITLE),
    kind: isPull ? 'pull' : 'issue',
    draft: isPull && record?.draft === true,
  };
}

export async function listOpenItems(
  config: GithubAppConfig,
  repo: string,
): Promise<GithubOpenItemList> {
  const cached = cache.get(repo);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const token = await getInstallationToken(config);
  const rows = await callGithub<unknown[]>(
    `/repos/${repo}/issues?state=open&sort=updated&per_page=${PER_PAGE}`,
    token,
  );

  const items = rows.flatMap((row) => {
    const item = readItem(row);
    return item ? [item] : [];
  });
  const value = { items, truncated: rows.length >= PER_PAGE };
  cache.set(repo, { value, at: Date.now() });
  return value;
}
