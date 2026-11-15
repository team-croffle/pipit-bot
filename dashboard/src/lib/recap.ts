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

export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

export function periodLabel(period: Pick<RecapPeriod, 'id' | 'kind'>): string {
  if (period.kind === 'year') {
    return `${period.id}년`;
  }
  const [year, month] = period.id.split('-');
  return `${year}년 ${Number(month)}월`;
}

export function formatPlayed(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours}시간` : `${hours}시간 ${minutes % 60}분`;
}

/** The shared playlist a year's recap makes (src/lib/music/recap/year-playlist.ts). */
export function yearPlaylistName(year: string): string {
  return `${year} 결산`;
}
