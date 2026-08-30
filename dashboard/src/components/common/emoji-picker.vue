<script setup lang="ts">
  import { Smile } from 'lucide-vue-next';
  import { ref } from 'vue';

  import { fetchJson } from '@/api';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import type { DiscordEmoji } from '@/types';

  defineProps<{ disabled?: boolean }>();
  const emit = defineEmits<{ pick: [text: string] }>();

  /**
   * A short palette rather than the full Unicode set: the OS emoji keyboard is one
   * shortcut away for anything else, and what the dashboard can offer that it cannot
   * is the guild's own emoji.
   */
  const common = [
    '✅',
    '❌',
    '⚠️',
    '🚀',
    '🎉',
    '🔥',
    '👀',
    '👍',
    '🙏',
    '💬',
    '📝',
    '🔔',
    '🔒',
    '🐛',
    '✨',
    '📌',
  ];

  const emojis = ref<DiscordEmoji[]>([]);
  const loading = ref(false);
  const failed = ref(false);
  let requested = false;

  // Same bargain as the member picker — the list is only worth a request once
  // somebody actually opens the menu.
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
      failed.value = true;
      requested = false;
    } finally {
      loading.value = false;
    }
  }
</script>

<template>
  <DropdownMenu @update:open="$event && load()">
    <DropdownMenuTrigger as-child>
      <Button
        type="button"
        variant="outline"
        size="icon"
        :disabled="disabled"
        aria-label="이모지 넣기"
        title="이모지 넣기"
      >
        <Smile />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-72 p-3">
      <p class="text-muted-foreground mb-2 text-xs">기본 이모지</p>
      <div class="mb-3 grid grid-cols-8 gap-1">
        <button
          v-for="emoji in common"
          :key="emoji"
          type="button"
          class="hover:bg-accent rounded-md p-1 text-lg leading-none"
          @click="emit('pick', emoji)"
        >
          {{ emoji }}
        </button>
      </div>

      <p class="text-muted-foreground mb-2 text-xs">서버 이모지</p>
      <p v-if="loading" class="text-muted-foreground text-xs">불러오는 중…</p>
      <p v-else-if="failed" class="text-muted-foreground text-xs">
        서버 이모지를 불러오지 못했습니다.
      </p>
      <p v-else-if="emojis.length === 0" class="text-muted-foreground text-xs">
        이 서버에는 커스텀 이모지가 없습니다.
      </p>
      <div v-else class="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto">
        <button
          v-for="emoji in emojis"
          :key="emoji.id"
          type="button"
          class="hover:bg-accent rounded-md p-1"
          :title="`:${emoji.name}:`"
          @click="emit('pick', emoji.markup)"
        >
          <img :src="emoji.url" :alt="emoji.name" class="size-5" loading="lazy" />
        </button>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
