import { asc } from 'drizzle-orm';

import { getDb } from '../db/client.js';
import type { Transaction } from '../db/migrate-file.js';
import { reactionRoleOptions, reactionRolePanels } from '../db/schema.js';
import type { EmbedTemplate } from '../embed/template.js';
import type { ReactionRoleOption, ReactionRoleSettings } from './settings.js';

/**
 * Reaction role panels as rows. The dashboard saves the panels as a whole, so a save
 * replaces them as a whole, in one transaction — at most 25 panels of 20 choices.
 */

export async function writePanels(tx: Transaction, settings: ReactionRoleSettings): Promise<void> {
  await tx.delete(reactionRolePanels);
  for (const [position, panel] of settings.panels.entries()) {
    await tx.insert(reactionRolePanels).values({
      id: panel.id,
      position,
      name: panel.name,
      channelId: panel.channelId,
      messageId: panel.messageId,
      singleReaction: panel.singleReaction,
      embed: panel.embed,
    });
    if (panel.options.length > 0) {
      await tx.insert(reactionRoleOptions).values(
        panel.options.map((option, index) => ({
          panelId: panel.id,
          position: index,
          emoji: option.emoji,
          roleId: option.roleId,
        })),
      );
    }
  }
}

export function savePanels(settings: ReactionRoleSettings): Promise<void> {
  return getDb().transaction((tx) => writePanels(tx, settings));
}

export async function readPanels(): Promise<ReactionRoleSettings> {
  const db = getDb();
  const options = await db
    .select()
    .from(reactionRoleOptions)
    .orderBy(asc(reactionRoleOptions.panelId), asc(reactionRoleOptions.position));
  const byPanel = new Map<string, ReactionRoleOption[]>();
  for (const option of options) {
    const list = byPanel.get(option.panelId) ?? [];
    list.push({ emoji: option.emoji, roleId: option.roleId });
    byPanel.set(option.panelId, list);
  }

  const panels = await db
    .select()
    .from(reactionRolePanels)
    .orderBy(asc(reactionRolePanels.position));
  return {
    panels: panels.map((row) => ({
      id: row.id,
      name: row.name,
      channelId: row.channelId,
      messageId: row.messageId,
      singleReaction: row.singleReaction,
      embed: row.embed as EmbedTemplate,
      options: byPanel.get(row.id) ?? [],
    })),
  };
}
