/**
 * Matching a reaction against the emoji an operator picked.
 *
 * The picker stores what the dashboard shows: `:name:` for a custom emoji, the
 * character itself for a standard one. Discord hands a reaction back as an id and a
 * name instead, so the two have to be brought together here.
 *
 * The older `<:name:id>` markup is still accepted. It was never stored by the panel
 * editor, but it is what a hand-edited settings file is most likely to contain.
 */

import type { EmojiIdentifierResolvable, Guild, MessageReaction } from 'discord.js';

const MARKUP = /^<a?:(\w+):(\d{17,20})>$/;
const SHORTCODE = /^:([a-z\d_]{2,32}):$/i;

interface WantedEmoji {
  /** Set when the operator picked a custom emoji we could identify. */
  id?: string;
  /** The custom emoji's name, or the character of a standard one. */
  name: string;
}

/** What the stored emoji refers to, resolved against the guild where it can be. */
function wanted(emoji: string, guild?: Guild): WantedEmoji {
  const trimmed = emoji.trim();

  const markup = MARKUP.exec(trimmed);
  if (markup?.[1] && markup[2]) {
    return { id: markup[2], name: markup[1] };
  }

  const shortcode = SHORTCODE.exec(trimmed);
  if (shortcode?.[1]) {
    const name = shortcode[1];
    const custom = guild?.emojis.cache.find(
      (candidate) => candidate.name?.toLowerCase() === name.toLowerCase(),
    );
    return custom ? { id: custom.id, name } : { name };
  }

  return { name: trimmed };
}

/** What `message.react` needs: the id of a custom emoji, or the character itself. */
export function emojiToReact(emoji: string, guild?: Guild): EmojiIdentifierResolvable {
  const target = wanted(emoji, guild);
  return target.id ?? target.name;
}

/**
 * True when this reaction is the one the option asked for.
 *
 * A custom emoji is compared by id wherever we have one, since that survives a
 * rename. A shortcode for an emoji the guild no longer has falls back to the name,
 * which is the most the bot can still tell.
 */
export function reactionMatchesEmoji(reaction: MessageReaction, emoji: string): boolean {
  const target = wanted(emoji, reaction.message.guild ?? undefined);

  if (target.id) {
    return reaction.emoji.id === target.id;
  }

  if (reaction.emoji.id) {
    return reaction.emoji.name?.toLowerCase() === target.name.toLowerCase();
  }

  return reaction.emoji.name === target.name;
}
