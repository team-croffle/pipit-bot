import { intlLocale, t } from '@/i18n';

/** Shapes the recap API returns (src/api/routes/music-recaps.ts) — no person in any of them. */

export interface RecapTrack {
  fileKey: string;
  title: string;
  listens: number;
  playedSec: number;
}

export interface RecapSummary {
  period: string;
  kind: 'month' | 'year';
  timeZone: string;
  plays: number;
  listens: number;
  playedSec: number;
  tracks: number;
  participants?: number;
  autoplayShare: number;
  topTracks: RecapTrack[];
  byWeekday: number[];
  byHour: number[];
  months?: { plays: number; playedSec: number }[];
}

export interface RecapPeriod {
  id: string;
  kind: 'month' | 'year';
  open: boolean;
  postedAt: string | null;
}

/** Calendar names come from Intl in the current language, so they follow a switch. */
function format(options: Intl.DateTimeFormatOptions, date: Date): string {
  return new Intl.DateTimeFormat(intlLocale(), { ...options, timeZone: 'UTC' }).format(date);
}

/** Monday first, like the recap's `byWeekday` (2026-01-05 was a Monday). */
export function weekdays(): string[] {
  return Array.from({ length: 7 }, (_, day) =>
    format({ weekday: 'short' }, new Date(Date.UTC(2026, 0, 5 + day))),
  );
}

export function monthLabels(): string[] {
  return Array.from({ length: 12 }, (_, month) =>
    format({ month: 'short' }, new Date(Date.UTC(2026, month, 1))),
  );
}

export function hourLabels(): string[] {
  return Array.from({ length: 24 }, (_, hour) => t('recap.hour', { hour }));
}

export function periodLabel(period: Pick<RecapPeriod, 'id' | 'kind'>): string {
  const [year = 0, month = 1] = period.id.split('-').map(Number);
  if (period.kind === 'year') {
    return format({ year: 'numeric' }, new Date(Date.UTC(year, 0, 1)));
  }
  return format({ year: 'numeric', month: 'long' }, new Date(Date.UTC(year, month - 1, 1)));
}

/** The day a running period's recap is posted: the first of the next month (or year). */
export function dueLabel(period: Pick<RecapPeriod, 'id' | 'kind'>): string {
  const [year = 0, month = 12] = period.id.split('-').map(Number);
  if (period.kind === 'year' || month === 12) {
    return format(
      { year: 'numeric', month: 'long', day: 'numeric' },
      new Date(Date.UTC(year + 1, 0, 1)),
    );
  }
  return format({ month: 'long', day: 'numeric' }, new Date(Date.UTC(year, month, 1)));
}

export function formatPlayed(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return t('recap.minutes', { minutes });
  }
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0
    ? t('recap.hours', { hours })
    : t('recap.hoursMinutes', { hours, minutes: minutes % 60 });
}

/**
 * The shared playlist a year's recap makes (src/lib/music/recap/year-playlist.ts).
 * The name is the server's and is not translated: the page finds the playlist by it.
 */
export function yearPlaylistName(year: string): string {
  return `${year} 결산`;
}
