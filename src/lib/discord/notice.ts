import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
  type RepliableInteraction,
} from 'discord.js';

/**
 * A short result banner — what an action did, in one line, with an optional detail and
 * footer. Interactions get it as a reply only the person who acted can see; a message
 * in the music channel gets it as a public post (music-channel-message listener).
 *
 * Built with Components V2, so it cannot carry `content` or `embeds` alongside.
 */
export interface Notice {
  ok: boolean;
  message: string;
  detail?: string;
}

const ACCENT_OK = 0xe9a23b;
const ACCENT_FAILED = 0xd9534f;

export function noticeContainer(notice: Notice, footer?: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(notice.ok ? ACCENT_OK : ACCENT_FAILED)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${notice.ok ? '✅' : '⚠️'} **${notice.message}**`),
    );

  if (notice.detail) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(notice.detail));
  }

  if (footer) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
  }

  return container;
}

/** Usable both to send and to edit a message (the two option types differ in discord.js). */
export function noticeMessage(notice: Notice, footer?: string) {
  return {
    components: [noticeContainer(notice, footer)],
    flags: MessageFlags.IsComponentsV2 as const,
    allowedMentions: { parse: [] as never[] },
  };
}

export function disappearsIn(seconds: number): string {
  return `이 메시지는 ${seconds}초 뒤에 사라져요`;
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
  const footer = options.seconds ? disappearsIn(options.seconds) : undefined;
  const components = [noticeContainer(notice, footer)];

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
