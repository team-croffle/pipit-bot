import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { moveQueuedTrack } from '../../lib/music/queue-actions.js';

@ApplyOptions<Command.Options>({
  description: 'Move a queued track: !move <from> <to> (1-based)',
  aliases: ['mv'],
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message, args: Args): Promise<void> {
    const result = await this.doMove(message.guildId, args);

    if (message.channel.isSendable()) {
      await message.channel.send(result);
    }
  }

  private async doMove(guildId: string | null, args: Args): Promise<string> {
    if (!guildId) {
      return 'No guild ID provided';
    }

    const from = await args.pick('integer').catch(() => null);
    const to = await args.pick('integer').catch(() => null);
    if (from === null || to === null) {
      return 'Usage: `!move <from> <to>` — positions as shown by `!queue`.';
    }

    const result = moveQueuedTrack({ index: from }, to, guildId);
    // The shared message names the track plainly; the channel gets it in bold.
    return result.title
      ? result.message.replace(result.title, `**${result.title}**`)
      : result.message;
  }
}
