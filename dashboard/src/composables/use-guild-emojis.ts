import { ref } from 'vue';

import { fetchJson } from '@/api';
import type { DiscordEmoji } from '@/types';

/**
 * The custom emoji the bot can offer — this guild's, plus the bot's own.
 *
 * Module-level rather than per-component: the picker and every preview need the same
 * list, and one page can hold a dozen of them. The list is small and changes rarely,
 * so a single request for the page's lifetime is the right trade.
 */
const emojis = ref<DiscordEmoji[]>([]);
const loading = ref(false);
const failed = ref(false);
let requested = false;

async function load(): Promise<void> {
  if (requested) {
    return;
  }

  requested = true;
  loading.value = true;
  try {
    const body = await fetchJson<{ emojis: DiscordEmoji[] }>('/api/discord/emojis');
    emojis.value = body.emojis;
  } catch {
    // A preview that cannot resolve a name renders it as text, which is also what
    // the bot does — so a failure here costs nothing but the picture.
    failed.value = true;
    requested = false;
  } finally {
    loading.value = false;
  }
}

export function useGuildEmojis() {
  return { emojis, loading, failed, load };
}
