import { ref, shallowRef } from 'vue';

export interface UnicodeEmoji {
  emoji: string;
  name: string;
  slug: string;
}

export interface UnicodeEmojiGroup {
  name: string;
  slug: string;
  emojis: UnicodeEmoji[];
}

/**
 * The standard emoji set, from unicode.org data.
 *
 * WHY this ships as data rather than being fetched: Discord has no endpoint for the
 * standard set — only for custom guild and application emoji. Its own picker gets
 * this list from a file bundled into the client, which is the same thing happening
 * here.
 *
 * Loaded through a dynamic import so ~840KB of JSON stays out of the main bundle and
 * only arrives when somebody opens the picker.
 *
 * WHY shallowRef: this is 1,914 frozen records that never change. A deep ref would
 * wrap every one of them in a Proxy on assignment and walk those proxies on every
 * render, for reactivity nothing here needs.
 */
const groups = shallowRef<UnicodeEmojiGroup[]>([]);
const loading = ref(false);
let requested = false;

async function load(): Promise<void> {
  if (requested) {
    return;
  }

  requested = true;
  loading.value = true;
  try {
    const data = await import('unicode-emoji-json/data-by-group.json');
    groups.value = (data.default ?? data) as UnicodeEmojiGroup[];
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
