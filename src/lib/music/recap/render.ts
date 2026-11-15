import { EmbedBuilder, escapeMarkdown } from 'discord.js';

import type { RecapSummary } from './aggregate.js';

/**
 * A recap as a Discord embed. It names tracks and counts people, never who asked for a
 * track. A personal recap uses the same layout under a different heading.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ACCENT = 0x5865f2;
const TITLE_MAX = 60;

export function formatPlayed(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
}

export function periodLabel(summary: Pick<RecapSummary, 'period' | 'kind'>): string {
  if (summary.kind === 'year') {
    return summary.period;
  }
  const [year, month] = summary.period.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

function busiest(counts: number[], label: (index: number) => string): string | null {
  const most = Math.max(...counts);
  return most > 0 ? label(counts.indexOf(most)) : null;
}

function clip(title: string): string {
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;
}

export function renderRecap(
  summary: RecapSummary,
  options: { personal?: boolean; playlistName?: string } = {},
): EmbedBuilder {
  const label = periodLabel(summary);
  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle(options.personal ? `Your music — ${label}` : `Music recap — ${label}`);

  if (summary.plays === 0) {
    return embed.setDescription('Nothing played in this period.');
  }

  const totals = [
    `**${formatPlayed(summary.playedSec)}** played`,
    `**${summary.plays}** plays`,
    `**${summary.tracks}** tracks`,
    ...(summary.participants === undefined ? [] : [`**${summary.participants}** listeners`]),
  ];
  embed.setDescription(totals.join(' · '));

  if (summary.topTracks.length > 0) {
    embed.addFields({
      name: 'Most played',
      value: summary.topTracks
        .map(
          (track, index) =>
            `${index + 1}. ${escapeMarkdown(clip(track.title))} — ${track.listens}×`,
        )
        .join('\n')
        .slice(0, 1024),
    });
  }

  const day = busiest(summary.byWeekday, (index) => WEEKDAYS[index]!);
  const hour = busiest(summary.byHour, (index) => `${String(index).padStart(2, '0')}:00`);
  const rhythm = [
    day ? `Busiest day: **${day}**` : null,
    hour ? `Busiest hour: **${hour}**` : null,
    summary.autoplayShare > 0 ? `Autoplay: **${Math.round(summary.autoplayShare * 100)}%**` : null,
  ].filter(Boolean);
  if (rhythm.length > 0) {
    embed.addFields({ name: 'Rhythm', value: rhythm.join('\n') });
  }

  if (summary.months) {
    const months = summary.months
      .map((month, index) =>
        month.plays > 0 ? `${MONTHS[index]} ${formatPlayed(month.playedSec)}` : null,
      )
      .filter(Boolean);
    if (months.length > 0) {
      embed.addFields({ name: 'By month', value: months.join(' · ').slice(0, 1024) });
    }
  }

  if (options.playlistName) {
    embed.addFields({
      name: 'Playlist',
      value: `The year's most played are in the shared playlist **${escapeMarkdown(options.playlistName)}**.`,
    });
  }

  return embed.setFooter({ text: `Times in ${summary.timeZone}` });
}
