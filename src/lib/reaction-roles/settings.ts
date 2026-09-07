/**
 * Reaction role panels.
 *
 * A panel is one message the bot owns: the operator composes the embed in the
 * dashboard, the bot publishes it, and the emoji it reacts with hand out the roles.
 *
 * WHY the bot publishes rather than pointing at a message that already exists: the
 * old model asked the operator to paste a message id copied out of Discord, which
 * left the wording, the emoji and the roles in three places that nothing kept in
 * agreement. Owning the message means republishing can edit it in place, and the
 * reactions can be reconciled against the options on every save.
 *
 * WHY a store of its own rather than another slice of `guild-events.json`: that
 * document is replaced whole on every write, and a panel carries far more than a
 * couple of ids.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { dataDir } from '../constants.js';
import { emptyEmbedTemplate, parsePlainEmbedTemplate } from '../embed/template.js';
import type { EmbedTemplate } from '../embed/template.js';

export interface ReactionRoleOption {
  /** A `:name:` shortcode for a custom emoji, or the character for a standard one. */
  emoji: string;
  roleId: string;
}

export interface ReactionRolePanel {
  /** Stable across renames and republishes; the dashboard and the routes key on it. */
  id: string;
  /** Operator-facing label. Never sent to Discord. */
  name: string;
  channelId: string;
  /** `null` until the bot has published the panel. */
  messageId: string | null;
  embed: EmbedTemplate;
  options: ReactionRoleOption[];
}

export interface ReactionRoleSettings {
  panels: ReactionRolePanel[];
}

const settingsPath = join(dataDir, 'reaction-roles.json');
const snowflake = /^\d{17,20}$/;
const panelId = /^[\w-]{1,64}$/;

const MAX_PANELS = 25;
const MAX_OPTIONS = 20;
const MAX_EMOJI_LENGTH = 100;
const MAX_NAME_LENGTH = 100;

function emptySettings(): ReactionRoleSettings {
  return { panels: [] };
}

let cache: ReactionRoleSettings | undefined;

function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && snowflake.test(value);
}

function parseOptions(value: unknown, label: string): ReactionRoleOption[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${label} options must be an array`);
  }

  const options: ReactionRoleOption[] = [];
  const seen = new Set<string>();

  for (const item of value.slice(0, MAX_OPTIONS)) {
    if (!item || typeof item !== 'object') {
      throw new Error(`${label} has an option that is not an object`);
    }

    const row = item as Record<string, unknown>;
    const emoji = typeof row.emoji === 'string' ? row.emoji.trim() : '';
    if (!emoji || emoji.length > MAX_EMOJI_LENGTH) {
      throw new Error(`${label} has an option without a usable emoji`);
    }

    if (!isSnowflake(row.roleId)) {
      throw new Error(`${label} has an option without a role`);
    }

    // Discord counts one reaction per emoji, so a repeat would silently shadow the
    // earlier role rather than add a second choice.
    if (seen.has(emoji)) {
      throw new Error(`${label} uses ${emoji} twice`);
    }

    seen.add(emoji);
    options.push({ emoji, roleId: row.roleId });
  }

  return options;
}

function parsePanel(value: unknown, index: number): ReactionRolePanel {
  if (!value || typeof value !== 'object') {
    throw new Error(`Panel ${index + 1} is not an object`);
  }

  const row = value as Record<string, unknown>;
  const label = `Panel ${index + 1}`;

  if (typeof row.id !== 'string' || !panelId.test(row.id)) {
    throw new Error(`${label} needs an id`);
  }

  if (!isSnowflake(row.channelId)) {
    throw new Error(`${label} needs a channel`);
  }

  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`${label} name is longer than ${MAX_NAME_LENGTH} characters`);
  }

  const messageId = row.messageId;
  if (messageId !== null && messageId !== undefined && !isSnowflake(messageId)) {
    throw new Error(`${label} has an unusable message id`);
  }

  return {
    id: row.id,
    name,
    channelId: row.channelId,
    messageId: isSnowflake(messageId) ? messageId : null,
    embed: parsePlainEmbedTemplate(row.embed, label),
    options: parseOptions(row.options, label),
  };
}

export function parseReactionRoleSettings(raw: unknown): ReactionRoleSettings {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Settings must be an object');
  }

  const body = raw as Record<string, unknown>;
  const panels = body.panels ?? [];
  if (!Array.isArray(panels)) {
    throw new Error('panels must be an array');
  }

  const parsed = panels.slice(0, MAX_PANELS).map((panel, index) => parsePanel(panel, index));

  const ids = new Set<string>();
  for (const panel of parsed) {
    if (ids.has(panel.id)) {
      throw new Error(`Two panels share the id ${panel.id}`);
    }

    ids.add(panel.id);
  }

  return { panels: parsed };
}

export function emptyPanel(id: string): ReactionRolePanel {
  return {
    id,
    name: '',
    channelId: '',
    messageId: null,
    embed: emptyEmbedTemplate(),
    options: [],
  };
}

export function getReactionRoleSettings(): ReactionRoleSettings {
  return cache ?? emptySettings();
}

/** The panel a reaction landed on, or nothing if the message is not one of ours. */
export function findPanelByMessage(messageId: string): ReactionRolePanel | undefined {
  return getReactionRoleSettings().panels.find((panel) => panel.messageId === messageId);
}

export async function loadReactionRoleSettings(): Promise<ReactionRoleSettings> {
  try {
    cache = parseReactionRoleSettings(JSON.parse(await readFile(settingsPath, 'utf8')) as unknown);
  } catch {
    cache = emptySettings();
  }

  return getReactionRoleSettings();
}

export async function saveReactionRoleSettings(
  next: ReactionRoleSettings,
): Promise<ReactionRoleSettings> {
  const parsed = parseReactionRoleSettings(next);
  await mkdir(dataDir, { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  cache = parsed;
  return parsed;
}

/** Replaces one panel in the store, leaving the others as they are. */
export async function updatePanel(panel: ReactionRolePanel): Promise<ReactionRolePanel> {
  const settings = getReactionRoleSettings();
  const panels = settings.panels.map((stored) => (stored.id === panel.id ? panel : stored));
  const saved = await saveReactionRoleSettings({ panels });
  return saved.panels.find((stored) => stored.id === panel.id) ?? panel;
}
