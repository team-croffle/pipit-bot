<script setup lang="ts">
  import { computed } from 'vue';

  import { useGuildEmojis } from '@/composables/use-guild-emojis';

  /**
   * Renders template text the way the bot will send it: `:name:` becomes the server
   * emoji's image, everything else stays literal. A name the server does not have is
   * left as typed, which is exactly what the bot does with it.
   */
  const props = defineProps<{ text: string }>();

  const { emojis, load } = useGuildEmojis();
  void load();

  const SHORTCODE = /:([a-z\d_]{2,32}):/gi;

  interface Part {
    kind: 'text' | 'emoji';
    value: string;
    url?: string;
  }

  const parts = computed<Part[]>(() => {
    const result: Part[] = [];
    let index = 0;

    for (const match of props.text.matchAll(SHORTCODE)) {
      const at = match.index;
      const name = match[1] ?? '';
      const emoji = emojis.value.find(
        (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
      );
      if (!emoji) {
        continue;
      }

      if (at > index) {
        result.push({ kind: 'text', value: props.text.slice(index, at) });
      }
      result.push({ kind: 'emoji', value: name, url: emoji.url });
      index = at + match[0].length;
    }

    if (index < props.text.length) {
      result.push({ kind: 'text', value: props.text.slice(index) });
    }

    return result;
  });
</script>

<template>
  <span class="wrap-break-word whitespace-pre-wrap"
    ><template v-for="(part, index) in parts" :key="index"
      ><img
        v-if="part.kind === 'emoji'"
        :src="part.url"
        :alt="`:${part.value}:`"
        :title="`:${part.value}:`"
        class="inline-block size-[1.2em] align-text-bottom"
      /><template v-else>{{ part.value }}</template></template
    ></span
  >
</template>
