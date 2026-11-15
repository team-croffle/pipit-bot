/**
 * Recap periods: `2026-11` is a month, `2026` a year, both in the recap settings' time
 * zone — November in Seoul starts at 2026-10-31T15:00Z.
 */

export type PeriodKind = 'month' | 'year';

export interface Period {
  id: string;
  kind: PeriodKind;
  year: number;
  /** 1–12 for a month. */
  month?: number;
}

const PERIOD = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/;

export function parsePeriod(id: string): Period | null {
  const match = PERIOD.exec(id);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  return match[2]
    ? { id, kind: 'month', year, month: Number(match[2]) }
    : { id, kind: 'year', year };
}

export function monthPeriod(year: number, month: number): Period {
  // Month arithmetic may run past either end of a year.
  const date = new Date(Date.UTC(year, month - 1, 1));
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return { id: `${y}-${String(m).padStart(2, '0')}`, kind: 'month', year: y, month: m };
}

export function yearPeriod(year: number): Period {
  return { id: String(year), kind: 'year', year };
}

/** The wall-clock parts of an instant in a time zone. */
export function localParts(
  at: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

/** The month and the year that contain an instant. */
export function currentPeriods(at: Date, timeZone: string): { month: Period; year: Period } {
  const local = localParts(at, timeZone);
  return { month: monthPeriod(local.year, local.month), year: yearPeriod(local.year) };
}

/** The month and the year just before the ones that contain an instant — what is due for posting. */
export function previousPeriods(at: Date, timeZone: string): { month: Period; year: Period } {
  const local = localParts(at, timeZone);
  return { month: monthPeriod(local.year, local.month - 1), year: yearPeriod(local.year - 1) };
}

/** The local wall-clock start of a period, as `YYYY-MM-DD 00:00:00` (for SQL `AT TIME ZONE`). */
export function periodStartLocal(period: Period): string {
  return `${period.year}-${String(period.month ?? 1).padStart(2, '0')}-01 00:00:00`;
}

/**
 * The instant a local wall-clock time happens in a time zone. Two passes settle a
 * daylight-saving shift; a time that does not exist lands just after the gap.
 */
export function zonedInstant(year: number, month: number, day: number, timeZone: string): Date {
  const wanted = Date.UTC(year, month - 1, day);
  let guess = wanted;
  for (let pass = 0; pass < 2; pass += 1) {
    const local = localParts(new Date(guess), timeZone);
    const seen = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    guess += wanted - seen;
  }
  return new Date(guess);
}

/** When the next month begins after an instant — the next time a recap can fall due. */
export function nextMonthStart(at: Date, timeZone: string): Date {
  const local = localParts(at, timeZone);
  const next = monthPeriod(local.year, local.month + 1);
  return zonedInstant(next.year, next.month!, 1, timeZone);
}
