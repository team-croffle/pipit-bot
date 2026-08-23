import type { EmojiIdentifierResolvable, Guild, MessageReaction } from 'discord.js';

import type { ReactionRoleMapping } from './guild-event-settings.js';

const customEmoji = /<a?:(\w+):(\d{17,20})>/;

export function emojiToReact(raw: string): EmojiIdentifierResolvable {
  const match = customEmoji.exec(raw.trim());
  if (match?.[2]) {
    return match[2];
  }

  return raw.trim();
}

export function reactionMatchesMapping(reaction: MessageReaction, emoji: string): boolean {
  const trimmed = emoji.trim();
  const custom = customEmoji.exec(trimmed);
  const id = reaction.emoji.id;
  const name = reaction.emoji.name;

  if (custom?.[2]) {
    return id === custom[2];
  }

  if (id) {
    return trimmed === id || trimmed === `${name}:${id}` || trimmed.endsWith(`:${id}`);
  }

  return name === trimmed;
}

export async function syncReactionRoleEmojis(
  guild: Guild,
  mappings: ReactionRoleMapping[],
): Promise<void> {
  for (const mapping of mappings) {
    const channel = guild.channels.cache.get(mapping.channelId);
    if (!channel?.isTextBased()) {
      continue;
    }

    try {
      const message = await channel.messages.fetch(mapping.messageId);
      await message.react(emojiToReact(mapping.emoji));
    } catch {
      continue;
    }
  }
}
