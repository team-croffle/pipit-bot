import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import {
  ActionRowBuilder,
  type ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { replyNotice, type Notice } from '../lib/discord/notice.js';
import { requestBannerRefresh } from '../lib/music/banner/manager.js';
import { REMOTE } from '../lib/music/banner/render.js';
import { getVolumeLevel } from '../lib/music/pcm-volume.js';
import {
  getPlaybackState,
  pausePlayback,
  resumePlayback,
  setLoopMode,
  skipPlayback,
  stopPlayback,
  type LoopMode,
} from '../lib/music/playback.js';
import { setVolumeLevel } from '../lib/music/queue-actions.js';
import { queueText } from '../lib/music/queue-view.js';
import type { VolumeLevel } from '../lib/music/volume-levels.js';
import { isMusicChannel } from '../preconditions/music-channel.js';

export const PLAY_MODAL = 'music:play-modal';
export const PLAY_MODAL_QUERY = 'query';
export const SEARCH_MODAL = 'music:search-modal';

/** Seconds a button's result stays before it removes itself (the reference design). */
const RESULT_SECONDS = 5;

const LOOP_NEXT: Record<string, LoopMode> = { off: 'track', track: 'queue', queue: 'off' };
const VOLUME_STEPS: VolumeLevel[] = ['low', 'mid', 'high'];

function stepVolume(by: -1 | 1): Notice {
  const index = VOLUME_STEPS.indexOf(getVolumeLevel()) + by;
  const level = VOLUME_STEPS[Math.min(Math.max(index, 0), VOLUME_STEPS.length - 1)];
  return setVolumeLevel(level);
}

function playModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(PLAY_MODAL)
    .setTitle('곡 재생')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(PLAY_MODAL_QUERY)
          .setLabel('곡 제목이나 링크')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(500),
      ),
    );
}

function searchModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(SEARCH_MODAL)
    .setTitle('곡 검색')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(PLAY_MODAL_QUERY)
          .setLabel('찾을 곡')
          .setPlaceholder('곡 제목, 가수 이름 등')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(200),
      ),
    );
}

/**
 * The music channel banner's buttons. Each runs the same function the slash command
 * does, answers only the person who pressed it, and redraws the banner at once.
 */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class MusicRemoteButton extends InteractionHandler {
  public override parse(interaction: ButtonInteraction) {
    return interaction.customId.startsWith('music:') ? this.some() : this.none();
  }

  public override async run(interaction: ButtonInteraction) {
    if (!isMusicChannel(interaction.channelId)) {
      await replyNotice(interaction, {
        ok: false,
        message: 'Music commands can only be used in a designated music channel.',
      });
      return;
    }

    if (interaction.customId === REMOTE.play) {
      // A modal has to be the first answer — no defer before it.
      await interaction.showModal(playModal());
      return;
    }

    if (interaction.customId === REMOTE.search) {
      await interaction.showModal(searchModal());
      return;
    }

    if (interaction.customId === REMOTE.queue) {
      await replyNotice(interaction, { ok: true, message: 'Queue', detail: queueText() });
      return;
    }

    const notice = this.act(interaction.customId);
    await replyNotice(interaction, notice, { seconds: RESULT_SECONDS });
    requestBannerRefresh();
  }

  private act(customId: string): Notice {
    switch (customId) {
      case REMOTE.pause:
        return pausePlayback();
      case REMOTE.resume:
        return resumePlayback();
      case REMOTE.skip:
        return skipPlayback();
      case REMOTE.stop:
        return stopPlayback();
      case REMOTE.loop:
        return setLoopMode(LOOP_NEXT[getPlaybackState().repeatMode] ?? 'off');
      case REMOTE.volumeDown:
        return stepVolume(-1);
      case REMOTE.volumeUp:
        return stepVolume(1);
      default:
        return { ok: false, message: 'That button no longer does anything.' };
    }
  }
}
