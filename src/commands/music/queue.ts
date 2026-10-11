import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { queueText } from '../../lib/music/queue-view.js';

@ApplyOptions<Command.Options>({
  description: 'Show the current track and the queue',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description)),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await replyNotice(interaction, { ok: true, message: 'Queue', detail: queueText() });
  }
}
