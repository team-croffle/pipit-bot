import { and, count, desc, gte, ilike, inArray, lt, lte, or, type SQL } from 'drizzle-orm';

import { getDb } from '../db/client.js';
import { auditEntries } from '../db/schema.js';
import type { AuditCategory, AuditEntry, AuditOutcome } from './types.js';

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
  /** A numbered page (from 1) of `limit` entries, with the total that matches. */
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

type Row = typeof auditEntries.$inferSelect;

/** An ISO time from a date or time the caller gave, or undefined when it is not one. */
function time(value: string | undefined, endOfDay = false): string | undefined {
  if (!value) {
    return undefined;
  }

  // WHY: a bare date as `to` means the whole of that day (UTC, as the old day files were).
  const text = endOfDay && value.length === 10 ? `${value}T23:59:59.999Z` : value;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** `%` and `_` typed into the search box are meant literally. */
function contains(text: string): string {
  return `%${text.replaceAll(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

function toEntry(row: Row): AuditEntry {
  return {
    at: new Date(row.at).toISOString(),
    category: row.category as AuditCategory,
    action: row.action,
    ...(row.actorName === null
      ? {}
      : { actor: { ...(row.actorId ? { id: row.actorId } : {}), name: row.actorName } }),
    ...(row.target === null ? {} : { target: row.target }),
    outcome: row.outcome as AuditOutcome,
    ...(row.detail === null ? {} : { detail: row.detail }),
  };
}

function where(query: AuditQuery): SQL | undefined {
  const from = time(query.from);
  const to = time(query.to, true);
  const before = time(query.before);
  const needle = query.search?.trim();
  return and(
    query.categories?.length ? inArray(auditEntries.category, query.categories) : undefined,
    from ? gte(auditEntries.at, from) : undefined,
    to ? lte(auditEntries.at, to) : undefined,
    before ? lt(auditEntries.at, before) : undefined,
    needle
      ? or(
          ilike(auditEntries.action, contains(needle)),
          ilike(auditEntries.actorName, contains(needle)),
          ilike(auditEntries.target, contains(needle)),
          ilike(auditEntries.detail, contains(needle)),
        )
      : undefined,
  );
}

/** Newest first: a numbered page with its total, or a page and the cursor to the next. */
export async function queryAudit(query: AuditQuery = {}): Promise<AuditPage> {
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const db = getDb();
  const filter = where(query);
  const select = () =>
    db
      .select()
      .from(auditEntries)
      .where(filter)
      .orderBy(desc(auditEntries.at), desc(auditEntries.id));

  if (query.page !== undefined) {
    const page = Math.max(query.page, 1);
    const [rows, [totals]] = await Promise.all([
      select()
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ total: count() }).from(auditEntries).where(filter),
    ]);
    return {
      entries: rows.map(toEntry),
      next: null,
      total: totals?.total ?? 0,
      page,
      pageSize: limit,
    };
  }

  const rows = await select().limit(limit + 1);
  const entries = rows.slice(0, limit).map(toEntry);
  return { entries, next: rows.length > limit ? entries.at(-1)!.at : null };
}
