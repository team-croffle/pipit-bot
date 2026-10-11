import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';

/**
 * Typed by shape rather than as `SlashCommandBuilder`: discord.js and the command
 * framework each carry their own copy of the builders package, and the two classes do not
 * match nominally.
 */
interface ContextBuilder {
  setContexts(...contexts: InteractionContextType[]): unknown;
  setIntegrationTypes(...types: ApplicationIntegrationType[]): unknown;
}

/**
 * Every Pipit slash command is installed to the server and usable only inside it.
 *
 * WHY global commands and not guild commands: the registry is filled before the client
 * logs in, when the server's id is not known yet, and Pipit runs in one server anyway.
 * The registry runs in bulk-overwrite mode (setup.ts), so a command that is no longer
 * registered here disappears from Discord on the next start.
 */
export function guildOnly<B extends ContextBuilder>(builder: B): B {
  builder.setContexts(InteractionContextType.Guild);
  builder.setIntegrationTypes(ApplicationIntegrationType.GuildInstall);
  return builder;
}
