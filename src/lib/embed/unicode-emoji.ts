import { gemoji } from 'gemoji';

/**
 * Standard emoji by shortcode — `:tada:` → 🎉 — for wording typed by hand. The picker
 * inserts the character itself, so this only matters for what an operator typed.
 *
 * WHY GitHub's list: Discord's own shortcodes are, nearly name for name, the ones GitHub
 * uses (`thumbsup`, `+1`, `white_check_mark`, `partying_face`). The few Discord spells
 * differently are aliased below.
 */

const DISCORD_ALIASES: Record<string, string> = {
  slight_smile: 'slightly_smiling_face',
  slight_frown: 'slightly_frowning_face',
  upside_down: 'upside_down_face',
  hugging: 'hugs',
  nerd: 'nerd_face',
  thinking_face: 'thinking',
};

let byName: Map<string, string> | undefined;

function table(): Map<string, string> {
  if (!byName) {
    byName = new Map();
    for (const entry of gemoji) {
      for (const name of entry.names) {
        byName.set(name, entry.emoji);
      }
    }
  }
  return byName;
}

/** The character for a shortcode name (without colons), or undefined. */
export function unicodeEmoji(name: string): string | undefined {
  const wanted = name.toLowerCase();
  return table().get(DISCORD_ALIASES[wanted] ?? wanted);
}
