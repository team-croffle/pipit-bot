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

  /**
   * Emits what belongs in the template: `:name:` for a server emoji, the character
   * itself for a Discord one. The bot turns the shortcode into the real emoji when it
   * sends, which is what keeps the editor readable.
   */
  const emit = defineEmits<{ pick: [text: string] }>();

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

  /**
   * Discord's built-in emoji, grouped the way its own picker groups them. Not the
   * whole Unicode set — the OS emoji keyboard is a keystroke away for anything rarer,
   * and these are the ones a notification actually reaches for.
   */
  const builtIn: { name: string; items: string[] }[] = [
    {
      name: '상태',
      items: ['✅', '❌', '⚠️', '🚫', '❗', '❓', '🔴', '🟡', '🟢', '🔵', '⏳', '🔒'],
    },
    {
      name: '작업',
      items: ['🔧', '🐛', '✨', '📝', '📌', '🔍', '🚀', '📦', '🔀', '♻️', '🧪', '📊'],
    },
    {
      name: '반응',
      items: ['👀', '👍', '👎', '🙏', '🎉', '🔥', '💯', '💬', '🤝', '☕', '😄', '😢'],
    },
  ];
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
    <DropdownMenuContent align="end" class="max-h-96 w-80 overflow-y-auto p-3">
      <!-- Server emoji first: they are the reason this picker exists, since the OS
           keyboard already covers the built-in ones. -->
      <p class="text-muted-foreground mb-2 text-xs font-medium">서버 이모지</p>
      <p v-if="loading" class="text-muted-foreground mb-3 text-xs">불러오는 중…</p>
      <p v-else-if="failed" class="text-muted-foreground mb-3 text-xs">
        서버 이모지를 불러오지 못했습니다.
      </p>
      <p v-else-if="emojis.length === 0" class="text-muted-foreground mb-3 text-xs">
        이 서버에는 커스텀 이모지가 없습니다.
      </p>
      <div v-else class="mb-4 grid grid-cols-8 gap-1">
        <button
          v-for="emoji in emojis"
          :key="emoji.id"
          type="button"
          class="hover:bg-accent rounded-md p-1"
          :title="`:${emoji.name}:`"
          @click="emit('pick', `:${emoji.name}:`)"
        >
          <img :src="emoji.url" :alt="emoji.name" class="size-5" loading="lazy" />
        </button>
      </div>

      <p class="text-muted-foreground mb-2 text-xs font-medium">디스코드 이모지</p>
      <div v-for="group in builtIn" :key="group.name" class="mb-2">
        <p class="text-muted-foreground mb-1 text-[0.65rem]">{{ group.name }}</p>
        <div class="grid grid-cols-8 gap-1">
          <button
            v-for="emoji in group.items"
            :key="emoji"
            type="button"
            class="hover:bg-accent rounded-md p-1 text-lg leading-none"
            @click="emit('pick', emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
