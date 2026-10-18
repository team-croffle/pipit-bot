import { readdir, readFile } from 'node:fs/promises';

import { AUDIT_FILE, dayKey, fileForDay, getAuditDir } from './store.js';
import type { AuditCategory, AuditEntry } from './types.js';

export interface AuditQuery {
  /** Inclusive, an ISO date or time. */
  from?: string;
  /** Inclusive, an ISO date or time. */
  to?: string;
  categories?: AuditCategory[];
  search?: string;
  limit?: number;
  /** Only entries older than this `at` — the cursor for the next page. */
  before?: string;
  /**
   * A numbered page (from 1) of `limit` entries. Reads every day the range touches so the
   * total is known; without it the query stops once it has `limit`.
   */
  page?: number;
}

export interface AuditPage {
  entries: AuditEntry[];
  /** The `before` for the next page, or null when there is no more. */
  next: string | null;
  /** With `page`: every matching entry, and the page and size given back. */
  total?: number;
  page?: number;
  pageSize?: number;
}

export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 500;

function parseLines(text: string): AuditEntry[] {
  const entries: AuditEntry[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    try {
      entries.push(JSON.parse(line) as AuditEntry);
    } catch {
      // A torn line (a crash mid-write) is skipped; the rest of the day still reads.
    }
  }

  return entries;
}

function matches(entry: AuditEntry, query: AuditQuery, needle: string): boolean {
  if (query.categories?.length && !query.categories.includes(entry.category)) {
    return false;
  }

  if ((query.from && entry.at < query.from) || (query.to && entry.at > query.to)) {
    return false;
  }

  if (query.before && entry.at >= query.before) {
    return false;
  }

  if (!needle) {
    return true;
  }

  return [entry.action, entry.actor?.name, entry.target, entry.detail].some((field) =>
    field?.toLowerCase().includes(needle),
  );
}

/** The newest day a query can reach, from `to` and `before`. */
function lastDayOf(query: AuditQuery): string {
  const bounds = [query.to, query.before].filter((value): value is string => Boolean(value));
  return bounds.length > 0 ? bounds.map((value) => dayKey(value)).toSorted()[0]! : '9999-12-31';
}

/** Newest first. Reads only the day files the range can touch. */
export async function queryAudit(query: AuditQuery = {}): Promise<AuditPage> {
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const needle = query.search?.trim().toLowerCase() ?? '';
  // WHY: a bare date as `to` would sort before every time on that day.
  const to = query.to?.length === 10 ? `${query.to}T23:59:59.999Z` : query.to;
  const effective: AuditQuery = { ...query, to };

  let names: string[];
  try {
    names = await readdir(getAuditDir());
  } catch {
    return { entries: [], next: null };
  }

  const firstDay = query.from ? dayKey(query.from) : '0000-01-01';
  const lastDay = lastDayOf(effective);
  const days = names
    .map((name) => AUDIT_FILE.exec(name)?.[1])
    .filter((day): day is string => day !== undefined && day >= firstDay && day <= lastDay)
    .toSorted((a, b) => b.localeCompare(a));

  const entries: AuditEntry[] = [];
  for (const day of days) {
    const text = await readFile(fileForDay(day), 'utf8').catch(() => '');
    entries.push(...parseLines(text).filter((entry) => matches(entry, effective, needle)));
    if (query.page === undefined && entries.length > limit) {
      break;
    }
  }

  const sorted = entries.toSorted((a, b) => b.at.localeCompare(a.at));
  if (query.page !== undefined) {
    const start = (Math.max(query.page, 1) - 1) * limit;
    return {
      entries: sorted.slice(start, start + limit),
      next: null,
      total: sorted.length,
      page: Math.max(query.page, 1),
      pageSize: limit,
    };
  }

  const page = sorted.slice(0, limit);
  return { entries: page, next: sorted.length > limit ? page.at(-1)!.at : null };
}
