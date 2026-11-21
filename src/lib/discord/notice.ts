import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
  type RepliableInteraction,
} from 'discord.js';

import { auditInteraction } from '../audit/discord.js';
import { languageOfLocale, type Language } from '../i18n/index.js';
import { phraseIn, textIn, type Phrase } from '../i18n/phrase.js';

/**
 * A short result banner — what an action did, in one line, with an optional detail and
 * footer. Interactions get it as a reply only the person who acted can see; a message
 * in the music channel gets it as a public post (music-channel-message listener).
 *
 * Built with Components V2, so it cannot carry `content` or `embeds` alongside.
 */
export interface Notice {
  ok: boolean;
  /** English; the audit log and the API carry it. */
  message: string;
  detail?: string;
  /** The message and detail in other languages (i18n/phrase.ts). */
  phrase?: Phrase;
  detailPhrase?: Phrase;
}

const ACCENT_OK = 0xe9a23b;
const ACCENT_FAILED = 0xd9534f;

export function noticeContainer(
  notice: Notice,
  footer?: string,
  language: Language = 'en',
): ContainerBuilder {
  const message = textIn(language, notice);
  const container = new ContainerBuilder()
    .setAccentColor(notice.ok ? ACCENT_OK : ACCENT_FAILED)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${notice.ok ? '✅' : '⚠️'} **${message}**`),
    );

  const detail = notice.detailPhrase ? phraseIn(language, notice.detailPhrase) : notice.detail;
  if (detail) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(detail));
  }

  if (footer) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
  }

  return container;
}

/** Usable both to send and to edit a message (the two option types differ in discord.js). */
export function noticeMessage(notice: Notice, footer?: string, language: Language = 'en') {
  return {
    components: [noticeContainer(notice, footer, language)],
    flags: MessageFlags.IsComponentsV2 as const,
    allowedMentions: { parse: [] as never[] },
  };
}

export function disappearsIn(seconds: number, language: Language = 'en'): string {
  return phraseIn(language, { key: 'disappearsIn', params: { count: seconds } });
}

/**
 * Answers an interaction with a notice only the person who acted can see. With
 * `seconds`, the reply removes itself after that long (the reference design's "사라져요").
 */
export async function replyNotice(
  interaction: RepliableInteraction,
  notice: Notice,
  options: { seconds?: number } = {},
): Promise<void> {
  auditInteraction(interaction, notice);
  // Only the person who acted sees it, so it speaks their Discord language.
  const language = languageOfLocale(interaction.locale);
  const footer = options.seconds ? disappearsIn(options.seconds, language) : undefined;
  const components = [noticeContainer(notice, footer, language)];

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ components, flags: MessageFlags.IsComponentsV2 });
  } else {
    await interaction.reply({
      components,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }

  if (options.seconds) {
    setTimeout(() => {
      void interaction.deleteReply().catch(() => undefined);
    }, options.seconds * 1000).unref();
  }
}
