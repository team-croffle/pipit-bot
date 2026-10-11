import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ModalSubmitInteraction } from 'discord.js';

import { replyNotice } from '../lib/discord/notice.js';
import { requestBannerRefresh } from '../lib/music/banner/manager.js';
import { requestPlay } from '../lib/music/request.js';
import { PLAY_MODAL, PLAY_MODAL_QUERY } from './music-remote-button.js';

const RESULT_SECONDS = 5;

/** The banner's play dialog: the same path as `/play`, answered only to the person. */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class MusicPlayModal extends InteractionHandler {
  public override parse(interaction: ModalSubmitInteraction) {
    return interaction.customId === PLAY_MODAL ? this.some() : this.none();
  }

  public override async run(interaction: ModalSubmitInteraction) {
    if (!interaction.inCachedGuild()) {
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
