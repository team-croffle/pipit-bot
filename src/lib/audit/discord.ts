import type { GuildMember, RepliableInteraction, User } from 'discord.js';

import type { Notice } from '../discord/notice.js';
import { audit } from './log.js';
import type { AuditActor } from './types.js';

/** Slash commands that belong to music — recorded as `music`, with no detail. */
const MUSIC_COMMANDS = new Set([
  'play',
  'playlist',
  'search',
  'join',
  'leave',
  'pause',
  'resume',
  'skip',
  'stop',
  'clear',
  'remove',
  'move',
  'shuffle',
  'back',
  'loop',
  'volume',
]);

/** Answers that only show something; nothing changed, so nothing is recorded. */
const LOOKS = new Set(['/queue', '/help', '/ping', 'button:music:queue']);

export function actorOf(user: User, member?: GuildMember | null): AuditActor {
  return { id: user.id, name: member?.displayName ?? user.globalName ?? user.username };
}

/** A search control's id carries the search id and an index; the action is the control. */
function controlId(customId: string): string {
  return /^(search|playlist):/.test(customId)
    ? customId.split(':').slice(0, 2).join(':')
    : customId;
}

function actionOf(interaction: RepliableInteraction): string {
  if (interaction.isChatInputCommand()) {
    return `/${interaction.commandName}`;
  }

  if (interaction.isButton()) {
    return `button:${controlId(interaction.customId)}`;
  }

  if (interaction.isModalSubmit()) {
    return `modal:${controlId(interaction.customId)}`;
  }

  if (interaction.isAnySelectMenu()) {
    return `select:${controlId(interaction.customId)}`;
  }

  return 'interaction';
}

function isMusic(action: string): boolean {
  if (action.startsWith('/')) {
    return MUSIC_COMMANDS.has(action.slice(1));
  }

  return /^(button|modal|select):(music|search|playlist):/.test(action);
}

/**
 * Records what a slash command, button or dialog did. Music says only that someone
 * used the feature — the answer names the track, so it is left out — and option
 * values are never recorded for any command.
 */
export function auditInteraction(interaction: RepliableInteraction, notice: Notice): void {
  const action = actionOf(interaction);
  if (LOOKS.has(action)) {
    return;
  }

  const music = isMusic(action);
  void audit({
    category: music ? 'music' : 'command',
    action,
    actor: actorOf(interaction.user, interaction.inCachedGuild() ? interaction.member : null),
    outcome: notice.ok ? 'ok' : 'failed',
    detail: music ? undefined : notice.message,
  });
}
