import { container } from '@sapphire/framework';
import { SlashCommandBuilder, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

import { isEnabled, type Feature } from '../features.js';

/**
 * Which feature a slash command belongs to: every command under `commands/music/` is
 * music, `/remind` is GitHub, and the rest (`/help`, `/ping`) always stay.
 */
export function featureOfCommand(command: {
  name: string;
  category?: string | null;
}): Feature | null {
  if (command.category === 'music') {
    return 'music';
  }
  return command.name === 'remind' ? 'github' : null;
}

export function isCommandEnabled(command: { name: string; category?: string | null }): boolean {
  const feature = featureOfCommand(command);
  return feature === null || isEnabled(feature);
}

/**
 * The slash commands of the switched-on features, as Discord takes them. Each command
 * describes itself to a stand-in registry — the same builder calls the framework makes —
 * so the list never drifts from what the commands register.
 */
export function enabledCommandData(): RESTPostAPIApplicationCommandsJSONBody[] {
  const data: RESTPostAPIApplicationCommandsJSONBody[] = [];
  for (const command of container.stores.get('commands').values()) {
    if (!isCommandEnabled(command) || !command.registerApplicationCommands) {
      continue;
    }

    const registry = {
      registerChatInputCommand(input: unknown) {
        const builder = new SlashCommandBuilder();
        const result =
          typeof input === 'function'
            ? (input as (b: SlashCommandBuilder) => unknown)(builder)
            : input;
        const json = (
          result as { toJSON?: () => RESTPostAPIApplicationCommandsJSONBody } | undefined
        )?.toJSON?.();
        data.push(json ?? builder.toJSON());
      },
      registerContextMenuCommand() {},
      addChatInputCommandNames() {},
      addContextMenuCommandNames() {},
      addChatInputCommandIds() {},
      addContextMenuCommandIds() {},
    };
    void command.registerApplicationCommands(registry as never);
  }
  return data;
}

/** Replaces the bot's slash commands with those of the switched-on features. */
export async function syncSlashCommands(): Promise<void> {
  const application = container.client.application;
  if (!application) {
    return;
  }

  const data = enabledCommandData();
  await application.commands.set(data);
  container.logger.info(
    `[commands] ${data.length} slash commands registered for the switched-on features`,
  );
}
