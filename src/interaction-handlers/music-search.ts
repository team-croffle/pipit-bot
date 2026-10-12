import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';

import { replyNotice } from '../lib/discord/notice.js';
import { requestBannerRefresh } from '../lib/music/banner/manager.js';
import { requestPlay } from '../lib/music/request.js';
import { getCandidate, getResults, PICK_PROBLEM_MESSAGE } from '../lib/music/search-results.js';
import { SEARCH_ID, searchResultsMessage } from '../lib/music/search-view.js';
import { isMusicChannel } from '../preconditions/music-channel.js';

const RESULT_SECONDS = 5;

/** `search:<part>:<searchId>[:<index>]` */
function parse(customId: string): { part: string; searchId: string; index: number } | null {
  const [prefix, part, searchId, index] = customId.split(':');
  if (prefix !== 'search' || !part || !searchId) {
    return null;
  }

  return { part: `${prefix}:${part}`, searchId, index: Number(index ?? 0) };
}

/** Picking a result in the select menu: redraw the message with that one marked. */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.SelectMenu,
})
export class MusicSearchPick extends InteractionHandler {
  public override parse(interaction: StringSelectMenuInteraction) {
    return interaction.customId.startsWith(`${SEARCH_ID.pick}:`) ? this.some() : this.none();
  }

  public override async run(interaction: StringSelectMenuInteraction) {
    const id = parse(interaction.customId);
    const results = id ? getResults(id.searchId, interaction.user.id) : undefined;
    if (!id || !results) {
      await replyNotice(interaction, { ok: false, message: PICK_PROBLEM_MESSAGE.expired });
      return;
    }

    const picked = Number(interaction.values[0] ?? 0);
    await interaction.update(searchResultsMessage(id.searchId, results, picked));
  }
}

/** Playing the picked result, now or next — the same path as `/play`. */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class MusicSearchPlay extends InteractionHandler {
  public override parse(interaction: ButtonInteraction) {
    return interaction.customId.startsWith(`${SEARCH_ID.play}:`) ||
      interaction.customId.startsWith(`${SEARCH_ID.next}:`)
      ? this.some()
      : this.none();
  }

  public override async run(interaction: ButtonInteraction) {
    if (!interaction.inCachedGuild()) {
      return;
    }

    if (!isMusicChannel(interaction.channelId)) {
      await replyNotice(interaction, {
        ok: false,
        message: 'Music commands can only be used in a designated music channel.',
      });
      return;
    }

    const id = parse(interaction.customId);
    const found = id ? getCandidate(id.searchId, id.index, interaction.user.id) : null;
    // Replacing the results message with the outcome; preparing can take a while.
    await interaction.deferUpdate();

    if (!found || 'problem' in found) {
      const problem = found && 'problem' in found ? found.problem : 'missing';
      await replyNotice(interaction, { ok: false, message: PICK_PROBLEM_MESSAGE[problem] });
      return;
    }

    const notice = await requestPlay({
      query: found.candidate.query,
      next: id?.part === SEARCH_ID.next,
      member: interaction.member,
      channel: interaction.channel,
    });
    await replyNotice(interaction, notice, { seconds: RESULT_SECONDS });
    requestBannerRefresh();
  }
}
