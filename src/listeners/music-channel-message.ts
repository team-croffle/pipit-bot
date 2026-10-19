import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import { escapeMarkdown, type Message } from 'discord.js';

import { actorOf } from '../lib/audit/discord.js';
import { audit } from '../lib/audit/log.js';
import { disappearsIn, noticeMessage, type Notice } from '../lib/discord/notice.js';
import { isEnabled } from '../lib/features.js';
import { requestBannerRefresh } from '../lib/music/banner/manager.js';
import { requestPlay } from '../lib/music/request.js';
import { getRuntimeConfig } from '../lib/runtime-config.js';

/** How long the public answer stays before it is removed with the request. */
const ANSWER_SECONDS = 8;

/** `!p` and `!play` were how requests were typed before slash commands; accept the habit. */
const OLD_PLAY = /^!(?:p|play|pn|playnext)\s+/i;

/**
 * A line typed into a music channel is a request: the bot plays it, removes the line,
 * and answers with a short banner everyone can see — a message cannot be answered
 * privately, only an interaction can — which then removes itself. The channel stays a
 * banner and nothing else.
 *
 * Only configured music channels: with none configured there is no banner to keep
 * clean, and every channel would turn into a request box.
 */
@ApplyOptions<Listener.Options>({ event: Events.MessageCreate })
export class UserEvent extends Listener<typeof Events.MessageCreate> {
  public override async run(message: Message) {
    if (
      message.author.bot ||
      message.system ||
      message.webhookId ||
      !message.inGuild() ||
      !getRuntimeConfig().musicChannelIds.includes(message.channelId) ||
      // Switched off: the channel is left alone — nothing is played or removed.
      !isEnabled('music')
    ) {
      return;
    }

    const content = message.content.trim();
    if (!content || !message.member) {
      return;
    }

    const name = escapeMarkdown(message.member.displayName);
    // Gone first, so the channel never shows the raw line for long. Without the
    // permission the request still runs; the line just stays.
    await message.delete().catch(() => undefined);

    const answer = await message.channel
      .send(
        noticeMessage({
          ok: true,
          message: '곡을 준비하고 있어요…',
          detail: `-# ${name}님의 요청`,
        }),
      )
      .catch(() => null);

    const notice = await this.handle(content, message);
    // Who asked, and whether it worked — not what was asked for.
    void audit({
      category: 'music',
      action: 'music.request',
      actor: actorOf(message.author, message.member),
      outcome: notice.ok ? 'ok' : 'failed',
    });
    await answer
      ?.edit(
        noticeMessage({ ...notice, detail: `-# ${name}님의 요청` }, disappearsIn(ANSWER_SECONDS)),
      )
      .catch(() => undefined);
    requestBannerRefresh();

    setTimeout(() => {
      void answer?.delete().catch(() => undefined);
    }, ANSWER_SECONDS * 1000).unref();
  }

  private async handle(content: string, message: Message<true>): Promise<Notice> {
    const query = content.replace(OLD_PLAY, '');
    if (query.startsWith('!')) {
      return {
        ok: false,
        message: 'Commands are slash commands now — type / to see them, or /help.',
      };
    }

    return requestPlay({ query, next: false, member: message.member!, channel: message.channel });
  }
}
