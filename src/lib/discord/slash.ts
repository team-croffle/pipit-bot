import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';

import { commandText } from '../i18n/locales/ko/commands.js';

/**
 * Typed by shape rather than as `SlashCommandBuilder`: discord.js and the command
 * framework each carry their own copy of the builders package, and the two classes do not
 * match nominally.
 */
interface ContextBuilder {
  setContexts(...contexts: InteractionContextType[]): unknown;
  setIntegrationTypes(...types: ApplicationIntegrationType[]): unknown;
  toJSON(): unknown;
}

interface Localizable {
  description?: string;
  description_localizations?: Record<string, string> | null;
  name?: string;
  name_localizations?: Record<string, string> | null;
  options?: Localizable[];
  choices?: Localizable[];
}

/**
 * Adds the Korean description (and choice names) to a command and everything under it.
 * What the command already localizes itself (/recap's periods) is kept.
 */
function localize(node: Localizable, isChoice = false): void {
  if (node.description && !node.description_localizations?.ko && commandText[node.description]) {
    node.description_localizations = {
      ...node.description_localizations,
      ko: commandText[node.description],
    };
  }
  if (isChoice && node.name && !node.name_localizations?.ko && commandText[node.name]) {
    node.name_localizations = { ...node.name_localizations, ko: commandText[node.name] };
  }
  for (const option of node.options ?? []) {
    localize(option);
  }
  for (const choice of node.choices ?? []) {
    localize(choice, true);
  }
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
  // Options are added after this call, so the Korean text is added to the finished JSON —
  // Discord shows each person the description in their own client language (v0.8.3).
  const toJSON = builder.toJSON.bind(builder);
  builder.toJSON = () => {
    const json = toJSON() as Localizable;
    localize(json);
    return json;
  };
  return builder;
}
