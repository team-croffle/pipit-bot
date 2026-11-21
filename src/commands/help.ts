import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { isCommandEnabled } from '../lib/discord/command-features.js';
import { replyNotice } from '../lib/discord/notice.js';
import { guildOnly } from '../lib/discord/slash.js';
import { languageOfLocale } from '../lib/i18n/index.js';
import { commandText } from '../lib/i18n/locales/ko/commands.js';
import { say } from '../lib/i18n/phrase.js';

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
    const korean = languageOfLocale(interaction.locale) === 'ko';
    const lines = [...this.container.stores.get('commands').values()]
      .filter((command) => isCommandEnabled(command))
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map((command) => {
        const description = korean
          ? (commandText[command.description] ?? command.description)
          : command.description;
        return `\`/${command.name}\` — ${description}`;
      });

    await replyNotice(interaction, { ok: true, ...say('commands'), detail: lines.join('\n') });
  }
}
