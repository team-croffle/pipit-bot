import { container } from '@sapphire/framework';
import { DiscordAPIError, RESTJSONErrorCodes, type SendableChannels } from 'discord.js';

import { getConfiguredGuild } from '../../discord-guild.js';
import { getRuntimeConfig } from '../../runtime-config.js';
import { getPlaybackState } from '../playback.js';
import { bannerSignature, renderBanner } from './render.js';
import {
  bannerChannels,
  bannerMessageId,
  forgetBanner,
  loadBannerStore,
  rememberBanner,
} from './store.js';

/**
 * Keeps one remote-control banner in every music channel and keeps it current.
 *
 * WHY polling the playback state instead of hooking every action: the state changes
 * from slash commands, the remote's buttons, the dashboard and the player itself (a
 * track ends). Comparing a signature every few seconds catches all of them in one
 * place; the banner is edited when what it shows changed, and on every tick while a
 * track plays so the progress bar moves (one edit per channel every three seconds stays
 * well inside Discord's per-channel edit limit). Actions taken from the banner ask for an
 * immediate refresh so the remote answers at once.
 */

const TICK_MS = 3_000;
/** A playing track redraws on every tick, a little early so timer drift never skips one. */
const PROGRESS_MS = TICK_MS - 500;

let lastSignature = '';
let lastDrawnAt = 0;
let busy = false;
let timer: ReturnType<typeof setInterval> | undefined;
const warned = new Set<string>();

function sendableChannel(channelId: string): SendableChannels | null {
  const channel = getConfiguredGuild()?.channels.cache.get(channelId);
  return channel?.isSendable() ? channel : null;
}

function warnOnce(channelId: string, reason: string, error: unknown): void {
  if (warned.has(channelId)) {
    return;
  }

  warned.add(channelId);
  container.logger.warn(`[music-banner] ${reason} in channel ${channelId}`, error);
}

/** Edits the channel's banner, or posts one when there is none (or it was deleted). */
async function draw(channelId: string, payload: ReturnType<typeof renderBanner>): Promise<void> {
  const channel = sendableChannel(channelId);
  if (!channel) {
    return;
  }

  const messageId = bannerMessageId(channelId);
  if (messageId) {
    try {
      await channel.messages.edit(messageId, payload);
      return;
    } catch (error) {
      if (!(error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage)) {
        warnOnce(channelId, 'could not edit the banner', error);
        return;
      }
    }
  }

  try {
    const sent = await channel.send(payload);
    await rememberBanner(channelId, sent.id);
    warned.delete(channelId);
  } catch (error) {
    warnOnce(channelId, 'could not post the banner', error);
  }
}

async function refresh(force: boolean): Promise<void> {
  if (busy) {
    return;
  }

  const state = getPlaybackState();
  const signature = bannerSignature(state);
  const now = Date.now();
  const progressDue = state.active && !state.paused && now - lastDrawnAt >= PROGRESS_MS;
  if (!force && signature === lastSignature && !progressDue) {
    return;
  }

  busy = true;
  try {
    const payload = renderBanner(state);
    for (const channelId of getRuntimeConfig().musicChannelIds) {
      await draw(channelId, payload);
    }
    lastSignature = signature;
    lastDrawnAt = now;
  } finally {
    busy = false;
  }
}

/** Ask for a redraw now — after an action taken from the banner itself. */
export function requestBannerRefresh(): void {
  void refresh(true).catch((error: unknown) => container.logger.warn('[music-banner]', error));
}

/**
 * Brings the banners in line with the configured music channels: one in each, and
 * none left behind in a channel that is no longer a music channel.
 */
export async function syncBanners(): Promise<void> {
  const channels = new Set(getRuntimeConfig().musicChannelIds);

  for (const channelId of bannerChannels()) {
    if (channels.has(channelId)) {
      continue;
    }

    const messageId = bannerMessageId(channelId);
    if (messageId) {
      await sendableChannel(channelId)
        ?.messages.delete(messageId)
        .catch(() => undefined);
    }
    await forgetBanner(channelId);
  }

  await refresh(true);
}

export async function startBanners(): Promise<void> {
  await loadBannerStore();
  await syncBanners();
  timer ??= setInterval(() => {
    void refresh(false).catch((error: unknown) => container.logger.warn('[music-banner]', error));
  }, TICK_MS);
  timer.unref();
}
