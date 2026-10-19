import { container } from '@sapphire/framework';
import type { RepliableInteraction } from 'discord.js';

import { getConfiguredGuild } from '../discord-guild.js';
import { replyNotice } from '../discord/notice.js';
import { isEnabled, onFeatureChange } from '../features.js';
import { requestBannerRefresh } from './banner/manager.js';
import { leaveVoiceChannel } from './voice-connection.js';

/**
 * Switching music off ends the session at once: the feeder and autoplay stop with the
 * queue, the bot leaves its voice channel, and the banner shows that music is off.
 * Switching it on only redraws the banner — playing waits for someone to ask.
 */
export function watchMusicSwitch(): void {
  onFeatureChange((feature, on) => {
    if (feature !== 'music') {
      return;
    }

    if (!on) {
      const guild = getConfiguredGuild();
      if (guild) {
        leaveVoiceChannel(guild.id);
      }
      container.logger.info('[music] switched off: the session was ended');
    }
    requestBannerRefresh();
  });
}

/**
 * For a remote button, picker or dialog left from before music was switched off: answers
 * that it is off and returns true, so the handler stops there.
 */
export async function refuseWhenMusicOff(interaction: RepliableInteraction): Promise<boolean> {
  if (isEnabled('music')) {
    return false;
  }
  await replyNotice(interaction, { ok: false, message: 'Music is switched off on this server.' });
  return true;
}
