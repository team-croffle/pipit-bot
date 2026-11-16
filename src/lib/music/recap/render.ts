import { EmbedBuilder, escapeMarkdown } from 'discord.js';
import type { TFunction } from 'i18next';

import { translator, type Language } from '../../i18n/index.js';
import type { RecapSummary } from './aggregate.js';

/**
 * A recap as a Discord embed, in the language asked for. It names tracks and counts
 * people, never who asked for a track. A personal recap uses the same layout under a
 * different heading.
 *
 * "When it played" shows the busiest weekday and hour; a tie shows all of them, so
 * the line never picks one of several equals without saying so.
 */

const ACCENT = 0x5865f2;
const TITLE_MAX = 60;

export function formatPlayed(seconds: number, t: TFunction): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return t('minutes', { m: minutes });
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? t('hours', { h }) : t('hoursMinutes', { h, m });
}

export function periodLabel(summary: Pick<RecapSummary, 'period' | 'kind'>, t: TFunction): string {
  const [year, month] = summary.period.split('-');
  return summary.kind === 'year'
    ? t('yearPeriod', { year })
    : t('monthPeriod', { year, month: t(`month.${Number(month) - 1}`) });
}

/** Every label tied for the most, or null when nothing was counted. */
function busiest(counts: number[], label: (index: number) => string): string | null {
  const most = Math.max(...counts);
  if (most <= 0) {
    return null;
  }
  return counts.flatMap((count, index) => (count === most ? [label(index)] : [])).join(', ');
}

function clip(title: string): string {
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;
}

export function renderRecap(
  summary: RecapSummary,
  options: { personal?: boolean; playlistName?: string; language?: Language } = {},
): EmbedBuilder {
  const t = translator(options.language ?? 'en', 'recap');
  const period = periodLabel(summary, t);
  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle(t(options.personal ? 'titlePersonal' : 'title', { period }));

  if (summary.plays === 0) {
    return embed.setDescription(t('empty'));
  }

  const totals = [
    t('played', { time: formatPlayed(summary.playedSec, t) }),
    t('plays', { count: summary.plays }),
    t('tracks', { count: summary.tracks }),
    ...(summary.participants ? [t('listeners', { count: summary.participants })] : []),
  ];
  embed.setDescription(totals.join(' · '));

  if (summary.topTracks.length > 0) {
    embed.addFields({
      name: t('mostPlayed'),
      value: summary.topTracks
        .map((track, index) =>
          t('track', {
            rank: index + 1,
            title: escapeMarkdown(clip(track.title)),
            count: track.listens,
          }),
        )
        .join('\n')
        .slice(0, 1024),
    });
  }

  const day = busiest(summary.byWeekday, (index) => t(`weekday.${index}`));
  const hour = busiest(summary.byHour, (index) => t('hour', { h: String(index).padStart(2, '0') }));
  const when = [
    day ? t('busiestDay', { value: day }) : null,
    hour ? t('busiestHour', { value: hour }) : null,
    summary.autoplayShare > 0
      ? t('autoplay', { value: Math.round(summary.autoplayShare * 100) })
      : null,
  ].filter(Boolean);
  if (when.length > 0) {
    embed.addFields({ name: t('whenPlayed'), value: when.join('\n') });
  }

  if (summary.months) {
    const months = summary.months
      .map((month, index) =>
        month.plays > 0 ? `${t(`month.${index}`)} ${formatPlayed(month.playedSec, t)}` : null,
      )
      .filter(Boolean);
    if (months.length > 0) {
      embed.addFields({ name: t('byMonth'), value: months.join(' · ').slice(0, 1024) });
    }
  }

  if (options.playlistName) {
    embed.addFields({
      name: t('playlistField'),
      value: t('playlist', { name: escapeMarkdown(options.playlistName) }),
    });
  }

  return embed.setFooter({ text: t('footer', { zone: summary.timeZone }) });
}
