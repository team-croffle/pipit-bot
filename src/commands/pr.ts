import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { parsePullRequestReference, remindItem } from '../lib/github/remind.js';

const USAGE = [
  'Tell me which pull request to remind about.',
  'Examples: `!pr owner/repo #12` · `!pr owner/repo 12` · `!pr https://github.com/owner/repo/pull/12`',
].join('\n');

/**
 * Asks the reviewers who have not reviewed yet to take a look.
 *
 * The reminder goes to the channel the repository's notifications go to — that is
 * where the team reads them — and this channel gets a one-line answer saying so, or
 * why nothing was sent. The verdict also lands in the dashboard's recent deliveries.
 */
@ApplyOptions<Command.Options>({
  description: 'Remind the pending reviewers of a pull request',
  runIn: ['GUILD_ANY'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message, args: Args): Promise<void> {
    const text = await args.rest('string').catch(() => '');
    const reference = parsePullRequestReference(text);
    if (!reference) {
      await message.reply(USAGE);
      return;
    }

    const result = await remindItem(reference);
    const subject = `${reference.repo}#${reference.number}`;

    if (result.outcome === 'sent') {
      const where = result.channelId ? ` in <#${result.channelId}>` : '';
      const who = result.targets === 1 ? '1 person' : `${result.targets} people`;
      await message.reply(`Reminded ${who} about ${subject}${where}.`);
      return;
    }

    if (result.outcome === 'edited') {
      await message.reply(`Nothing new to send for ${subject}; the announcement was updated.`);
      return;
    }

    const why = result.detail ? ` ${result.detail}` : '';
    await message.reply(`No reminder was sent for ${subject}.${why}`);
  }
}
