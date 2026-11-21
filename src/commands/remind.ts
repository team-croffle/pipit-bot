import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

import { replyNotice, type Notice } from '../lib/discord/notice.js';
import { guildOnly } from '../lib/discord/slash.js';
import { parseItemReference, remindReference } from '../lib/github/remind-reference.js';
import { say } from '../lib/i18n/phrase.js';

const USAGE = 'Examples: `owner/repo #12` · `repo #12` · `https://github.com/owner/repo/issues/12`';

const NOUN = { pull: 'pull request', issue: 'issue' } as const;

/**
 * Nudges whoever a pull request or issue is waiting on: the reviewers who have not
 * reviewed yet and the assignees of a pull request, the assignees of an issue.
 *
 * Pull requests and issues share one number space, so the number says which it is.
 * The reminder goes to the channel the repository's notifications go to — that is
 * where the team reads them — and the person who asked gets a reply only they see,
 * saying so or why nothing was sent. The verdict also lands in the dashboard's recent
 * deliveries.
 */
@ApplyOptions<Command.Options>({
  description: 'Remind whoever a pull request or issue is waiting on',
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description)).addStringOption(
        (option) =>
          option
            .setName('item')
            .setDescription('owner/repo #12, repo #12, or a pull request or issue link')
            .setRequired(true)
            .setMaxLength(300),
      ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const reference = parseItemReference(interaction.options.getString('item', true));
    if (!reference) {
      await replyNotice(interaction, {
        ok: false,
        ...say('remindWhich'),
        detail: USAGE,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await replyNotice(interaction, await this.remind(reference));
  }

  private async remind(
    reference: NonNullable<ReturnType<typeof parseItemReference>>,
  ): Promise<Notice> {
    const result = await remindReference(reference);
    const noun = result.kind ? ` (${NOUN[result.kind]})` : '';
    const subject = `${result.repo}#${reference.number}${noun}`;

    if (result.outcome === 'sent') {
      const where = result.channelId ? ` <#${result.channelId}>` : '';
      // A target is a person, or a team standing behind its mapped role.
      return { ok: true, ...say('reminded', { count: result.targets, subject, where }) };
    }

    if (result.outcome === 'edited') {
      return {
        ok: true,
        ...say('remindEdited', { subject }),
      };
    }

    return {
      ok: false,
      ...say('remindNone', { subject }),
      detail: result.detail,
    };
  }
}
