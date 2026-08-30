<script setup lang="ts">
  import { Smile } from 'lucide-vue-next';
  import { computed, ref } from 'vue';

  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Input } from '@/components/ui/input';
  import { useGuildEmojis } from '@/composables/use-guild-emojis';
  import { useUnicodeEmojis } from '@/composables/use-unicode-emojis';

  defineProps<{ disabled?: boolean }>();

  /**
   * Emits what belongs in the template: `:name:` for a custom emoji, the character
   * itself for a standard one. The bot turns the shortcode into the real emoji when
   * it sends, which is what keeps the editor readable.
   */
  const emit = defineEmits<{ pick: [text: string] }>();

  const { emojis, loading, failed, load } = useGuildEmojis();
  const { groups, loading: unicodeLoading, load: loadUnicode } = useUnicodeEmojis();

  const query = ref('');
  const needle = computed(() => query.value.trim().toLowerCase());

  // Custom emoji come from two places Discord will actually serve: this guild, and
  // the bot itself. The bot's work in every guild it is in.
  const serverEmojis = computed(() =>
    emojis.value.filter((emoji) => !emoji.application && matches(emoji.name)),
  );
  const botEmojis = computed(() =>
    emojis.value.filter((emoji) => emoji.application && matches(emoji.name)),
  );

  function matches(name: string): boolean {
    return !needle.value || name.toLowerCase().includes(needle.value);
  }

  const unicodeGroups = computed(() =>
    groups.value
      .map((group) => ({
        ...group,
        emojis: group.emojis.filter(
          (emoji) => matches(emoji.name) || emoji.slug.includes(needle.value),
        ),
      }))
      .filter((group) => group.emojis.length > 0),
  );

  function open(isOpen: boolean): void {
    if (!isOpen) {
      return;
    }

    void load();
    void loadUnicode();
  }
</script>

<template>
  <DropdownMenu @update:open="open">
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
    <DropdownMenuContent align="end" class="w-84 p-0">
      <div class="bg-popover sticky top-0 z-10 border-b p-2">
        <Input v-model="query" placeholder="이모지 검색…" class="h-8" />
      </div>

      <div class="max-h-80 overflow-y-auto p-3">
        <!-- Server emoji first: they are the reason this picker exists, since the OS
             keyboard already covers the standard ones. -->
        <section class="mb-4">
          <p class="text-muted-foreground mb-2 text-xs font-medium">서버 이모지</p>
          <p v-if="loading" class="text-muted-foreground text-xs">불러오는 중…</p>
          <p v-else-if="failed" class="text-muted-foreground text-xs">
            서버 이모지를 불러오지 못했습니다.
          </p>
          <p v-else-if="serverEmojis.length === 0" class="text-muted-foreground text-xs">
            {{ needle ? '검색 결과가 없습니다.' : '이 서버에는 커스텀 이모지가 없습니다.' }}
          </p>
          <div v-else class="grid grid-cols-8 gap-1">
            <button
              v-for="emoji in serverEmojis"
              :key="emoji.id"
              type="button"
              class="hover:bg-accent rounded-md p-1"
              :title="`:${emoji.name}:`"
              @click="emit('pick', `:${emoji.name}:`)"
            >
              <img :src="emoji.url" :alt="emoji.name" class="size-5" loading="lazy" />
            </button>
          </div>
        </section>

        <section v-if="botEmojis.length > 0" class="mb-4">
          <p class="text-muted-foreground mb-2 text-xs font-medium">
            봇 이모지
            <span class="font-normal">— 봇이 있는 모든 서버에서 사용</span>
          </p>
          <div class="grid grid-cols-8 gap-1">
            <button
              v-for="emoji in botEmojis"
              :key="emoji.id"
              type="button"
              class="hover:bg-accent rounded-md p-1"
              :title="`:${emoji.name}:`"
              @click="emit('pick', `:${emoji.name}:`)"
            >
              <img :src="emoji.url" :alt="emoji.name" class="size-5" loading="lazy" />
            </button>
          </div>
        </section>

        <section>
          <p class="text-muted-foreground mb-2 text-xs font-medium">기본 이모지</p>
          <p v-if="unicodeLoading" class="text-muted-foreground text-xs">불러오는 중…</p>
          <p v-else-if="unicodeGroups.length === 0" class="text-muted-foreground text-xs">
            검색 결과가 없습니다.
          </p>
          <div v-for="group in unicodeGroups" :key="group.slug" class="mb-3">
            <p class="text-muted-foreground mb-1 text-[0.65rem]">{{ group.name }}</p>
            <div class="grid grid-cols-8 gap-1">
              <button
                v-for="emoji in group.emojis"
                :key="emoji.slug"
                type="button"
                class="hover:bg-accent rounded-md p-1 text-lg leading-none"
                :title="emoji.name"
                @click="emit('pick', emoji.emoji)"
              >
                {{ emoji.emoji }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
