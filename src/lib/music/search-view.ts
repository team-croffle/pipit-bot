import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  escapeMarkdown,
} from 'discord.js';

import type { Notice } from '../discord/notice.js';
import { translator, type Language } from '../i18n/index.js';
import { say } from '../i18n/phrase.js';
import type { SearchCandidate } from './search-client.js';
import { formatDurationFromSeconds } from './track-format.js';

/**
 * Custom ids of the search result message: `search:<part>:<searchId>[:<index>]`.
 * Their own prefix — the remote's handler takes every `music:` id.
 */
export const SEARCH_ID = {
  pick: 'search:pick',
  play: 'search:play',
  next: 'search:next',
  save: 'search:save',
} as const;

const ACCENT = 0xe9a23b;

function label(index: number, candidate: SearchCandidate): string {
  const length = candidate.durationSec
    ? ` · ${formatDurationFromSeconds(candidate.durationSec)}`
    : '';
  const text = `${index + 1}. ${candidate.title}`;
  return `${text.length + length.length > 100 ? `${text.slice(0, 97 - length.length)}…` : text}${length}`;
}

/** The private message listing the results, with one picked (the first, until changed). */
export function searchResultsMessage(
  searchId: string,
  results: SearchCandidate[],
  picked = 0,
  language: Language = 'en',
) {
  const t = translator(language, 'music');
  const list = results
    .map((candidate, index) => {
      const mark = index === picked ? '▶' : '　';
      return `${mark} **${index + 1}.** ${escapeMarkdown(candidate.title)}${candidate.durationSec ? ` · ${formatDurationFromSeconds(candidate.durationSec)}` : ''}`;
    })
    .join('\n');

  const container = new ContainerBuilder()
    .setAccentColor(ACCENT)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(t('searchResults')))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(list))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(t('searchHint')));

  const select = new StringSelectMenuBuilder()
    .setCustomId(`${SEARCH_ID.pick}:${searchId}`)
    .setPlaceholder(t('pickTrack'))
    .addOptions(
      results.map((candidate, index) => ({
        label: label(index, candidate),
        value: String(index),
        default: index === picked,
      })),
    );

  const buttons = [
    new ButtonBuilder()
      .setCustomId(`${SEARCH_ID.play}:${searchId}:${picked}`)
      .setStyle(ButtonStyle.Primary)
      .setEmoji('▶️')
      .setLabel(t('playOrQueue')),
    new ButtonBuilder()
      .setCustomId(`${SEARCH_ID.next}:${searchId}:${picked}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⏭️')
      .setLabel(t('playNext')),
    new ButtonBuilder()
      .setCustomId(`${SEARCH_ID.save}:${searchId}:${picked}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📁')
      .setLabel(t('saveToPlaylist')),
  ];

  return {
    components: [
      container,
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
      new ActionRowBuilder<ButtonBuilder>().addComponents(buttons),
    ],
    flags: MessageFlags.IsComponentsV2 as const,
  };
}

/** What a search answers when there is nothing to pick from. */
export function noResultsNotice(): Notice {
  return { ok: false, ...say('noMatch') };
}
