import { ref } from 'vue';

import { fetchJson } from '@/api';
import type { DiscordEmoji } from '@/types';

/**
 * The guild's custom emoji, fetched once and shared.
 *
 * Module-level rather than per-component: the picker and every preview need the same
 * list, and one page can hold a dozen of them. The list is small and changes rarely,
 * so a single request for the page's lifetime is the right trade.
 */
const emojis = ref<DiscordEmoji[]>([]);
let requested = false;

async function load(): Promise<void> {
  if (requested) {
    return;
  }

  requested = true;
  try {
    const body = await fetchJson<{ emojis: DiscordEmoji[] }>('/api/discord/emojis');
    emojis.value = body.emojis;
  } catch {
    // A preview that cannot resolve a name renders it as text, which is also what
    // the bot does — so a failure here costs nothing but the picture.
    requested = false;
  }
}

export function useGuildEmojis() {
  void load();
  return { emojis, load };
}
