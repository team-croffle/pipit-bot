import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { getRuntimeConfig } from '../lib/runtime-config.js';

const MAX_MESSAGE_LENGTH = 1900;

@ApplyOptions<Command.Options>({
  description: 'List commands and usage',
  aliases: ['h', 'commands'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message): Promise<void> {
    if (!message.channel.isSendable()) {
      return;
    }

    await message.channel.send(this.buildHelp());
  }

  private buildHelp(): string {
    const prefix = getRuntimeConfig().prefix;
    const prefixText = typeof prefix === 'string' ? prefix : '!';

    const lines = ['**Commands**'];
    const commands = [...this.container.stores.get('commands').values()].toSorted((a, b) =>
      a.name.localeCompare(b.name),
    );

    for (const command of commands) {
      const aliases =
        command.aliases.length > 0
          ? ` (${command.aliases.map((alias) => `\`${alias}\``).join(', ')})`
          : '';
      lines.push(`\`${prefixText}${command.name}\`${aliases} — ${command.description}`);
    }

    return joinWithinLimit(lines);
  }
}

function joinWithinLimit(lines: string[]): string {
  const parts: string[] = [];
  let length = 0;

  for (const line of lines) {
    const extra = parts.length === 0 ? line.length : line.length + 1;
    if (length + extra > MAX_MESSAGE_LENGTH) {
      parts.push('…');
      break;
    }

    parts.push(line);
    length += extra;
  }

  return parts.join('\n');
}
