import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';

/**
 * Registration options every Pipit slash command shares: installed to the server, usable
 * only inside it.
 *
 * WHY global commands and not guild commands: the registry is filled before the client
 * logs in, when the server's id is not known yet, and Pipit runs in one server anyway.
 * The registry runs in bulk-overwrite mode (setup.ts), so a command that is no longer
 * registered here disappears from Discord on the next start.
 */
export const GUILD_ONLY = {
  integrationTypes: [ApplicationIntegrationType.GuildInstall],
  contexts: [InteractionContextType.Guild],
};
