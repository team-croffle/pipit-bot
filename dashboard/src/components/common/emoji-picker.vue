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

  function matches(name: string): boolean {
    return !needle.value || name.toLowerCase().includes(needle.value);
  }

  // Custom emoji come from the two places Discord will actually serve: this guild,
  // and the bot itself. The bot's work in every guild it is in.
  const serverEmojis = computed(() =>
    emojis.value.filter((emoji) => !emoji.application && matches(emoji.name)),
  );
  const botEmojis = computed(() =>
    emojis.value.filter((emoji) => emoji.application && matches(emoji.name)),
  );

  /**
   * Only one group is on screen at a time.
   *
   * WHY: the full set is 1,914 emoji, and the menu unmounts its content when it
   * closes — so rendering them all meant building 1,914 buttons on every open, which
   * is what made the picker stutter. The largest single group is a fifth of that.
   */
  const active = ref(0);

  const SEARCH_LIMIT = 96;

  const visible = computed(() => {
    if (needle.value) {
      // A search reaches across every group, capped so a one-letter query cannot
      // rebuild the whole set.
      const hits = groups.value.flatMap((group) =>
        group.emojis.filter((emoji) => matches(emoji.name) || emoji.slug.includes(needle.value)),
      );

      return { emojis: hits.slice(0, SEARCH_LIMIT), truncated: hits.length > SEARCH_LIMIT };
    }

    return { emojis: groups.value[active.value]?.emojis ?? [], truncated: false };
  });

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
    <!-- No enter/exit animation: it runs while the list is being built, which turns a
         brief pause into visible stutter. -->
    <DropdownMenuContent
      align="end"
      class="w-84 animate-none p-0 duration-0 data-[state=closed]:animate-none data-[state=open]:animate-none"
    >
      <div class="bg-popover sticky top-0 z-10 border-b p-2">
        <Input v-model="query" placeholder="이모지 검색…" class="h-8" />
      </div>

      <div class="max-h-80 overflow-y-auto p-3">
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

          <div v-if="!needle && groups.length > 0" class="mb-2 flex flex-wrap gap-1">
            <button
              v-for="(group, index) in groups"
              :key="group.slug"
              type="button"
              class="rounded-md px-1.5 py-0.5 text-[0.65rem]"
              :class="
                index === active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              "
              @click="active = index"
            >
              {{ group.name }}
            </button>
          </div>

          <p v-if="unicodeLoading" class="text-muted-foreground text-xs">불러오는 중…</p>
          <p v-else-if="visible.emojis.length === 0" class="text-muted-foreground text-xs">
            검색 결과가 없습니다.
          </p>
          <div v-else class="grid grid-cols-8 gap-1">
            <button
              v-for="emoji in visible.emojis"
              :key="emoji.slug"
              type="button"
              class="hover:bg-accent rounded-md p-1 text-lg leading-none"
              :title="emoji.name"
              @click="emit('pick', emoji.emoji)"
            >
              {{ emoji.emoji }}
            </button>
          </div>
          <p v-if="visible.truncated" class="text-muted-foreground mt-2 text-[0.65rem]">
            상위 {{ SEARCH_LIMIT }}개만 표시합니다 — 검색어를 더 좁혀 보세요.
          </p>
        </section>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
