import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { parseItemReference, remindReference } from '../lib/github/remind-reference.js';

const USAGE = [
  'Tell me which pull request or issue to remind about.',
  'Examples: `!remind owner/repo #12` · `!remind repo #12` · `!remind https://github.com/owner/repo/issues/12`',
].join('\n');

const NOUN = { pull: 'pull request', issue: 'issue' } as const;

/**
 * Nudges whoever a pull request or issue is waiting on: the reviewers who have not
 * reviewed yet and the assignees of a pull request, the assignees of an issue.
 *
 * Pull requests and issues share one number space, so the number says which it is.
 * The reminder goes to the channel the repository's notifications go to — that is
 * where the team reads them — and this channel gets a one-line answer saying so, or
 * why nothing was sent. The verdict also lands in the dashboard's recent deliveries.
 */
@ApplyOptions<Command.Options>({
  description: 'Remind whoever a pull request or issue is waiting on',
  runIn: ['GUILD_ANY'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message, args: Args): Promise<void> {
    const text = await args.rest('string').catch(() => '');
    const reference = parseItemReference(text);
    if (!reference) {
      await message.reply(USAGE);
      return;
    }

    const result = await remindReference(reference);
    const noun = result.kind ? ` (${NOUN[result.kind]})` : '';
    const subject = `${result.repo}#${reference.number}${noun}`;

    if (result.outcome === 'sent') {
      const where = result.channelId ? ` in <#${result.channelId}>` : '';
      // A target is a person, or a team standing behind its mapped role.
      const who = result.targets === 1 ? '1 person or team' : `${result.targets} people or teams`;
      await message.reply(`Reminded ${who} about ${subject}${where}.`);
      return;
    }

    if (result.outcome === 'edited') {
      await message.reply(
        `Nothing to send for ${subject}; its announcement was brought up to date.`,
      );
      return;
    }

    const why = result.detail ? ` ${result.detail}` : '';
    await message.reply(`No reminder was sent for ${subject}.${why}`);
  }
}
