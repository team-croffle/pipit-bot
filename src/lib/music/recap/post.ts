import { container } from '@sapphire/framework';

import { audit } from '../../audit/log.js';
import { getConfiguredGuild } from '../../discord-guild.js';
import { messageLanguage } from '../../i18n/settings.js';
import { buildRecap, type RecapSummary } from './aggregate.js';
import type { Period } from './periods.js';
import { getRecap, markPosted, saveRecap } from './recaps-store.js';
import { renderRecap } from './render.js';
import { getRecapSettings } from './settings.js';

/**
 * Posts a period's recap to the recap channel: builds it, keeps the summary, sends the
 * embed and records the message. A period with no plays is not posted.
 *
 * Steps that run after a year's recap is posted (the year's playlist) register here, so
 * this module does not need to know them.
 */

export type PostOutcome =
  | { ok: true; messageId: string; summary: RecapSummary }
  | { ok: false; reason: 'empty' | 'no-channel' | 'failed'; message: string };

type YearHook = (guildId: string, summary: RecapSummary) => Promise<string | undefined>;
const yearHooks: YearHook[] = [];

/** Runs after a year's recap is built; may return a playlist name for the embed. */
export function onYearRecap(hook: YearHook): void {
  yearHooks.push(hook);
}

let send = async (channelId: string, payload: { embeds: unknown[] }): Promise<string> => {
  const channel = getConfiguredGuild()?.channels.cache.get(channelId);
  if (!channel?.isSendable()) {
    throw new Error('The recap channel cannot be posted in.');
  }
  const message = await channel.send(payload as Parameters<typeof channel.send>[0]);
  return message.id;
};

export async function postRecap(guildId: string, period: Period): Promise<PostOutcome> {
  const settings = getRecapSettings();
  if (!settings.channelId) {
    return { ok: false, reason: 'no-channel', message: 'No recap channel is set.' };
  }

  const summary = await buildRecap({
    guildId,
    period,
    timeZone: settings.timeZone,
    topN: settings.topN,
  });
  if (summary.plays === 0) {
    return { ok: false, reason: 'empty', message: 'Nothing played in this period.' };
  }

  let playlistName: string | undefined;
  if (period.kind === 'year') {
    for (const hook of yearHooks) {
      playlistName =
        (await hook(guildId, summary).catch((error: unknown) => {
          container.logger.warn('[recap] a step after the year recap failed:', error);
          return undefined;
        })) ?? playlistName;
    }
  }

  await saveRecap(guildId, period.id, period.kind, summary);
  try {
    const messageId = await send(settings.channelId, {
      embeds: [renderRecap(summary, { playlistName, language: messageLanguage('recap') }).toJSON()],
    });
    await markPosted(guildId, period.id, settings.channelId, messageId);
    void audit({ category: 'music', action: 'recap.post', target: period.id, outcome: 'ok' });
    return { ok: true, messageId, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The recap could not be posted.';
    container.logger.warn(`[recap] could not post ${period.id}:`, error);
    void audit({
      category: 'music',
      action: 'recap.post',
      target: period.id,
      outcome: 'failed',
      detail: message,
    });
    return { ok: false, reason: 'failed', message };
  }
}

/** True when a period's recap has already gone out. */
export async function isPosted(guildId: string, periodId: string): Promise<boolean> {
  return Boolean((await getRecap(guildId, periodId))?.postedAt);
}

/** For local checks: capture what would be sent. */
export function setRecapSenderForChecks(
  sender: (channelId: string, payload: { embeds: unknown[] }) => Promise<string>,
): void {
  send = sender;
}
