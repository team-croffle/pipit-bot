import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { replyNotice } from '../lib/discord/notice.js';
import { guildOnly } from '../lib/discord/slash.js';

@ApplyOptions<Command.Options>({
  description: 'List the commands',
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description)),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const lines = [...this.container.stores.get('commands').values()]
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map((command) => `\`/${command.name}\` — ${command.description}`);

    await replyNotice(interaction, { ok: true, message: 'Commands', detail: lines.join('\n') });
  }
}
