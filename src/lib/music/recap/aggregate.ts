import { sql, type SQL } from 'drizzle-orm';

import { getDb } from '../../db/client.js';
import { periodStartLocal, type Period, type PeriodKind } from './periods.js';

/**
 * A period's recap, counted in SQL from the play history.
 *
 * WHY no person in it: a recap may say how many people listened, never who asked for
 * what. The shape has no field that could carry a person, so nothing built from it can
 * show one. A personal recap is the same shape over one person's own plays, built when
 * asked and never stored.
 *
 * A play counts as listened to when it played to the end, or for half the track — or a
 * minute, when the length is unknown. Tracks are ranked by listens, then time played.
 */

export const LISTENED_SHARE = 0.5;
export const LISTENED_UNKNOWN_SEC = 60;

export interface RecapTrack {
  fileKey: string;
  title: string;
  listens: number;
  playedSec: number;
}

export interface RecapSummary {
  period: string;
  kind: PeriodKind;
  timeZone: string;
  plays: number;
  listens: number;
  playedSec: number;
  tracks: number;
  /** How many people asked for something; absent from a personal recap. */
  participants?: number;
  autoplayShare: number;
  topTracks: RecapTrack[];
  /** Plays per weekday, Monday first. */
  byWeekday: number[];
  /** Plays per hour of the day, 0–23. */
  byHour: number[];
  /** A year's plays and time per month, January first. */
  months?: { plays: number; playedSec: number }[];
}

const LISTENED = sql`(end_reason = 'finished' or (duration_sec > 0 and played_sec >= duration_sec * ${LISTENED_SHARE}::numeric) or (coalesce(duration_sec, 0) = 0 and played_sec >= ${LISTENED_UNKNOWN_SEC}::int))`;

type Row = Record<string, unknown>;

async function rows(query: SQL): Promise<Row[]> {
  return (await getDb().execute(query)) as unknown as Row[];
}

const num = (value: unknown): number => Number(value ?? 0);

/** Builds a period's recap — of everyone's plays, or of one person's own. */
export async function buildRecap(options: {
  guildId: string;
  period: Period;
  timeZone: string;
  topN: number;
  /** A Discord user id: that person's own recap. */
  personId?: string;
}): Promise<RecapSummary> {
  const { guildId, period, timeZone, topN, personId } = options;
  const span = period.kind === 'month' ? sql`interval '1 month'` : sql`interval '1 year'`;
  const start = periodStartLocal(period);
  const where = sql`guild_id = ${guildId}
    and started_at >= (${start}::timestamp at time zone ${timeZone})
    and started_at < ((${start}::timestamp + ${span}) at time zone ${timeZone})
    ${personId ? sql`and requester_id = ${personId}` : sql``}`;
  const local = sql`(started_at at time zone ${timeZone})`;

  const [totals] = await rows(sql`select count(*) as plays,
      count(*) filter (where ${LISTENED}) as listens,
      coalesce(sum(played_sec), 0) as played,
      count(distinct file_key) as tracks,
      count(distinct requester_id) as people,
      count(*) filter (where origin = 'autoplay') as autoplay
    from music_plays where ${where}`);
  const top = await rows(sql`select file_key,
      (array_agg(title order by started_at desc))[1] as title,
      count(*) filter (where ${LISTENED}) as listens,
      coalesce(sum(played_sec), 0) as played
    from music_plays where ${where}
    group by file_key
    having count(*) filter (where ${LISTENED}) > 0
    order by listens desc, played desc, file_key
    limit ${topN}`);
  const weekdays = await rows(sql`select extract(isodow from ${local})::int as d, count(*) as n
    from music_plays where ${where} group by 1`);
  const hours = await rows(sql`select extract(hour from ${local})::int as h, count(*) as n
    from music_plays where ${where} group by 1`);

  const plays = num(totals?.plays);
  const byWeekday = Array.from({ length: 7 }, () => 0);
  for (const row of weekdays) {
    byWeekday[num(row.d) - 1] = num(row.n);
  }
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const row of hours) {
    byHour[num(row.h)] = num(row.n);
  }

  const summary: RecapSummary = {
    period: period.id,
    kind: period.kind,
    timeZone,
    plays,
    listens: num(totals?.listens),
    playedSec: num(totals?.played),
    tracks: num(totals?.tracks),
    ...(personId ? {} : { participants: num(totals?.people) }),
    autoplayShare: plays > 0 ? num(totals?.autoplay) / plays : 0,
    topTracks: top.map((row) => ({
      fileKey: String(row.file_key),
      title: String(row.title),
      listens: num(row.listens),
      playedSec: num(row.played),
    })),
    byWeekday,
    byHour,
  };

  if (period.kind === 'year') {
    const months = await rows(sql`select extract(month from ${local})::int as m, count(*) as n,
        coalesce(sum(played_sec), 0) as played
      from music_plays where ${where} group by 1`);
    summary.months = Array.from({ length: 12 }, () => ({ plays: 0, playedSec: 0 }));
    for (const row of months) {
      summary.months[num(row.m) - 1] = { plays: num(row.n), playedSec: num(row.played) };
    }
  }

  return summary;
}

/** The months that have any plays, newest first — what the dashboard offers to look at. */
export async function monthsWithPlays(guildId: string, timeZone: string): Promise<string[]> {
  const found =
    await rows(sql`select distinct to_char(started_at at time zone ${timeZone}, 'YYYY-MM') as p
    from music_plays where guild_id = ${guildId} order by p desc`);
  return found.map((row) => String(row.p));
}
