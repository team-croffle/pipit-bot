import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { replyNotice } from '../lib/discord/notice.js';
import { guildOnly } from '../lib/discord/slash.js';

@ApplyOptions<Command.Options>({
  description: 'Check that the bot answers, and its gateway latency',
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description)),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await replyNotice(interaction, {
      ok: true,
      message: `Pong — ${Math.round(this.container.client.ws.ping)} ms`,
    });
  }
}
