import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ModalSubmitInteraction } from 'discord.js';

import { replyNotice } from '../lib/discord/notice.js';
import { requestBannerRefresh } from '../lib/music/banner/manager.js';
import { refuseWhenMusicOff } from '../lib/music/music-switch.js';
import { requestPlay } from '../lib/music/request.js';
import { answerSearch } from '../lib/music/search-flow.js';
import { PLAY_MODAL, PLAY_MODAL_QUERY, SEARCH_MODAL } from './music-remote-button.js';

const RESULT_SECONDS = 5;

/**
 * The banner's two dialogs, answered only to the person: play (the same path as `/play`)
 * and search (the same results picker as `/search`).
 */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class MusicPlayModal extends InteractionHandler {
  public override parse(interaction: ModalSubmitInteraction) {
    return interaction.customId === PLAY_MODAL || interaction.customId === SEARCH_MODAL
      ? this.some()
      : this.none();
  }

  public override async run(interaction: ModalSubmitInteraction) {
    if (await refuseWhenMusicOff(interaction)) {
      return;
    }
    if (!interaction.inCachedGuild()) {
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (interaction.customId === SEARCH_MODAL) {
      await answerSearch(interaction, interaction.fields.getTextInputValue(PLAY_MODAL_QUERY));
      return;
    }

    const notice = await requestPlay({
      query: interaction.fields.getTextInputValue(PLAY_MODAL_QUERY),
      next: false,
      member: interaction.member,
      channel: interaction.channel,
    });
    await replyNotice(interaction, notice, { seconds: RESULT_SECONDS });
    requestBannerRefresh();
  }
}
