<script setup lang="ts">
  import { Check, ListStart, Play, Search } from 'lucide-vue-next';
  import { ref } from 'vue';

  import { postJson } from '@/api';
  import StateBlock from '@/components/common/state-block.vue';
  import AddToPlaylist from '@/components/music/playlists/add-to-playlist.vue';
  import { Button } from '@/components/ui/button';
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from '@/components/ui/dialog';
  import { Input } from '@/components/ui/input';
  import { playlistFeedback } from '@/composables/use-playlist-saver';
  import type { MusicSearchResponse, MusicSearchResult } from '@/types';

  const props = defineProps<{ canEnqueue: boolean }>();
  const emit = defineEmits<{ added: [] }>();

  const open = ref(false);
  const query = ref('');
  const searched = ref(false);
  const loading = ref(false);
  const error = ref('');
  const searchId = ref<string | null>(null);
  const results = ref<MusicSearchResult[]>([]);
  /** Index → how it was added, so the row shows it and its buttons rest. */
  const added = ref<Record<number, 'play' | 'next'>>({});
  const busyIndex = ref<number | null>(null);
  const addError = ref('');

  function isRedirect(cause: unknown): boolean {
    return cause instanceof Error && cause.message.startsWith('Redirecting to login');
  }

  function length(seconds?: number): string {
    if (!seconds) {
      return '';
    }
    const minutes = Math.floor(seconds / 60);
    const rest = String(seconds % 60).padStart(2, '0');
    return minutes >= 60
      ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${rest}`
      : `${minutes}:${rest}`;
  }

  async function search(): Promise<void> {
    const text = query.value.trim();
    if (!text || loading.value) {
      return;
    }

    loading.value = true;
    searched.value = true;
    error.value = '';
    addError.value = '';
    added.value = {};
    try {
      const body = await postJson<MusicSearchResponse>('/api/music/search', { query: text });
      searchId.value = body.searchId;
      results.value = body.results;
    } catch (cause) {
      if (!isRedirect(cause)) {
        results.value = [];
        error.value = cause instanceof Error ? cause.message : '검색하지 못했습니다.';
      }
    } finally {
      loading.value = false;
    }
  }

  async function add(result: MusicSearchResult, next: boolean): Promise<void> {
    if (!searchId.value || !props.canEnqueue) {
      return;
    }

    busyIndex.value = result.index;
    addError.value = '';
    try {
      await postJson('/api/music/jobs', {
        jobId: crypto.randomUUID(),
        searchId: searchId.value,
        index: result.index,
        ...(next ? { next: true } : {}),
      });
      added.value = { ...added.value, [result.index]: next ? 'next' : 'play' };
      emit('added');
    } catch (cause) {
      if (!isRedirect(cause)) {
        addError.value = cause instanceof Error ? cause.message : '대기열에 추가하지 못했습니다.';
      }
    } finally {
      busyIndex.value = null;
    }
  }
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button type="button" variant="outline" data-search-open>
        <Search />
        검색
      </Button>
    </DialogTrigger>
    <DialogContent
      class="max-h-[85vh] overflow-x-hidden overflow-y-auto sm:max-w-lg [&>*]:min-w-0"
      data-search-dialog
    >
      <DialogHeader>
        <DialogTitle>곡 검색</DialogTitle>
        <DialogDescription>결과 중에서 골라 재생하거나 다음 곡으로 넣습니다.</DialogDescription>
      </DialogHeader>

      <form class="flex gap-2" @submit.prevent="search">
        <Input
          v-model="query"
          type="search"
          placeholder="곡 제목, 가수 이름 등"
          maxlength="200"
          class="min-w-0 flex-1"
          aria-label="찾을 곡"
          data-search-query
        />
        <Button type="submit" :disabled="loading || !query.trim()" data-search-submit>
          <Search />
          검색
        </Button>
      </form>

      <p v-if="!canEnqueue" class="text-muted-foreground text-sm" data-search-hint>
        검색은 할 수 있지만, 추가하려면 보이스 카드에서 봇을 통화방에 참여시키세요.
      </p>
      <p v-if="addError" class="text-destructive text-sm" role="alert">{{ addError }}</p>
      <p
        v-if="playlistFeedback && Date.now() - playlistFeedback.at < 8000"
        class="text-sm"
        :class="playlistFeedback.ok ? 'text-muted-foreground' : 'text-destructive'"
        data-search-playlist-feedback
      >
        {{ playlistFeedback.message }}
      </p>

      <StateBlock
        v-if="searched"
        :loading="loading"
        :error="error"
        :empty="results.length === 0"
        empty-text="검색 결과가 없습니다."
      >
        <ul class="flex list-none flex-col gap-2 p-0" data-search-results>
          <li
            v-for="result in results"
            :key="result.index"
            data-search-result
            class="border-border flex min-w-0 flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium" :title="result.title">{{ result.title }}</p>
              <p v-if="result.durationSec" class="text-muted-foreground tnum text-xs">
                {{ length(result.durationSec) }}
              </p>
            </div>
            <p
              v-if="added[result.index]"
              class="text-muted-foreground flex shrink-0 items-center gap-1 text-sm"
              data-search-added
            >
              <Check class="size-[1.125rem]" />
              {{ added[result.index] === 'next' ? '다음 곡으로 넣음' : '추가함' }}
            </p>
            <div v-else class="flex shrink-0 gap-2">
              <Button
                size="sm"
                :disabled="!canEnqueue || busyIndex !== null"
                data-search-action="play"
                @click="add(result, false)"
              >
                <Play />
                추가
              </Button>
              <Button
                size="sm"
                variant="outline"
                :disabled="!canEnqueue || busyIndex !== null"
                data-search-action="next"
                @click="add(result, true)"
              >
                <ListStart />
                다음에 재생
              </Button>
            </div>
            <AddToPlaylist
              v-if="searchId"
              :source="{ from: 'search', searchId, index: result.index }"
              size="sm"
              class="shrink-0"
            />
          </li>
        </ul>
      </StateBlock>
    </DialogContent>
  </Dialog>
</template>
