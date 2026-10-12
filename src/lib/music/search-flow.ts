import type { ChatInputCommandInteraction, ModalSubmitInteraction } from 'discord.js';

import { auditInteraction } from '../audit/discord.js';
import { replyNotice } from '../discord/notice.js';
import { searchMusic, SearchFailure } from './search-client.js';
import { saveSearch } from './search-results.js';
import { noResultsNotice, searchResultsMessage } from './search-view.js';

/**
 * Runs a search for `/search` or the remote's search dialog and answers with the private
 * results message. The interaction must already be deferred (searching can take seconds).
 */
export async function answerSearch(
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction,
  query: string,
): Promise<void> {
  const text = query.trim();
  if (!text) {
    await replyNotice(interaction, {
      ok: false,
      message: 'Type a song title or words to search for.',
    });
    return;
  }

  let results;
  try {
    results = await searchMusic(text);
  } catch (error) {
    const message = error instanceof SearchFailure ? error.message : 'Searching failed.';
    await replyNotice(interaction, { ok: false, message });
    return;
  }

  if (results.length === 0) {
    await replyNotice(interaction, noResultsNotice());
    return;
  }

  const searchId = saveSearch(interaction.user.id, results);
  auditInteraction(interaction, { ok: true, message: '' });
  await interaction.editReply(searchResultsMessage(searchId, results));
}
