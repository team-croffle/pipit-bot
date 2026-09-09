import type { ShortcodesDataset } from 'emojibase';
import { ref, shallowRef } from 'vue';

export interface UnicodeEmoji {
  emoji: string;
  name: string;
  slug: string;
  /**
   * What Discord calls this emoji in `:name:` form, most common first.
   *
   * Empty for the handful of emoji too new to have one, which stay searchable by
   * their unicode.org name.
   */
  shortcodes: string[];
}

export interface UnicodeEmojiGroup {
  name: string;
  slug: string;
  emojis: UnicodeEmoji[];
}

type RawGroup = Omit<UnicodeEmojiGroup, 'emojis'> & { emojis: Omit<UnicodeEmoji, 'shortcodes'>[] };

/**
 * The standard emoji set, from unicode.org data, named the way Discord names it.
 *
 * WHY this ships as data rather than being fetched: Discord has no endpoint for the
 * standard set — only for custom guild and application emoji. Its own picker gets
 * this list from a file bundled into the client, which is the same thing happening
 * here.
 *
 * WHY two datasets: unicode.org calls 🙂 "slightly smiling face", Discord calls it
 * `:slight_smile:`. Searching for what Discord shows you found nothing. The
 * shortcodes come from emojibase's JoyPixels set, which is the lineage Discord's own
 * names descend from — not an exact copy, but the closest published list, and it
 * carries the alternates so both spellings match.
 *
 * Loaded through a dynamic import so ~1MB of JSON stays out of the main bundle and
 * only arrives when somebody opens the picker.
 *
 * WHY shallowRef: this is 1,914 records built once and never changed. A deep ref
 * would wrap every one of them in a Proxy on assignment and walk those proxies on
 * every render, for reactivity nothing here needs.
 */
const groups = shallowRef<UnicodeEmojiGroup[]>([]);
const loading = ref(false);
let requested = false;

/** An emoji's code points, joined the way emojibase keys its datasets. */
function hexcode(emoji: string): string {
  return Array.from(emoji, (character) =>
    (character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0'),
  ).join('-');
}

/**
 * WHY the second lookup: `FE0F` is the selector that asks for the colourful
 * presentation of a character that also has a text one. `unicode-emoji-json` keeps it
 * (❤️ is `2764-FE0F`), emojibase drops it from the key (`2764`). Trying both spellings
 * covers the ~950 emoji where the two disagree.
 */
function shortcodesFor(dataset: ShortcodesDataset, emoji: string): string[] {
  const key = hexcode(emoji);
  const found = dataset[key] ?? dataset[key.replaceAll('-FE0F', '')];
  if (!found) {
    return [];
  }

  return Array.isArray(found) ? found : [found];
}

async function load(): Promise<void> {
  if (requested) {
    return;
  }

  requested = true;
  loading.value = true;
  try {
    const [data, shortcodes] = await Promise.all([
      import('unicode-emoji-json/data-by-group.json'),
      import('emojibase-data/en/shortcodes/joypixels.json'),
    ]);

    const dataset = (shortcodes.default ?? shortcodes) as ShortcodesDataset;
    groups.value = ((data.default ?? data) as RawGroup[]).map((group) => ({
      name: group.name,
      slug: group.slug,
      emojis: group.emojis.map((emoji) => ({
        ...emoji,
        shortcodes: shortcodesFor(dataset, emoji.emoji),
      })),
    }));
  } catch {
    // The custom emoji sections still work; this one just stays empty.
    requested = false;
  } finally {
    loading.value = false;
  }
}

export function useUnicodeEmojis() {
  return { groups, loading, load };
}
