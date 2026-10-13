<script setup lang="ts">
  import { ArrowDown, ArrowUp, Pencil, Play, Plus, Shuffle, Trash2, X } from 'lucide-vue-next';
  import { ref } from 'vue';

  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
  import { Input } from '@/components/ui/input';
  import { formatSeconds } from '@/lib/playlists';
  import type { PlaylistDetail } from '@/types';

  import PlaylistNameDialog from './playlist-name-dialog.vue';

  const props = defineProps<{ playlist: PlaylistDetail; busy: boolean; canPlay: boolean }>();
  const emit = defineEmits<{
    play: [shuffle: boolean];
    rename: [name: string];
    remove: [];
    addTyped: [query: string];
    removeItem: [itemId: string];
    moveItem: [itemId: string, to: number];
  }>();

  const renaming = ref(false);
  const confirming = ref(false);
  const typed = ref('');

  function addTyped(): void {
    const query = typed.value.trim();
    if (query) {
      emit('addTyped', query);
      typed.value = '';
    }
  }

  function rename(name: string): void {
    emit('rename', name);
    renaming.value = false;
  }

  function confirmRemove(): void {
    emit('remove');
    confirming.value = false;
  }
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4" data-playlist-detail>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h3 class="truncate text-lg font-semibold" data-playlist-title>{{ playlist.name }}</h3>
          <Badge variant="outline">{{ playlist.scope === 'shared' ? '공용' : '개인' }}</Badge>
        </div>
        <p class="text-muted-foreground tnum text-sm">
          {{ playlist.itemCount }}곡 · {{ formatSeconds(playlist.totalSec) }} ·
          {{ playlist.createdBy }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          :disabled="busy || !canPlay || playlist.itemCount === 0"
          data-playlist-play
          @click="emit('play', false)"
        >
          <Play />
          재생
        </Button>
        <Button
          variant="outline"
          :disabled="busy || !canPlay || playlist.itemCount === 0"
          data-playlist-shuffle
          @click="emit('play', true)"
        >
          <Shuffle />
          섞어서
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :disabled="busy"
          aria-label="이름 바꾸기"
          title="이름 바꾸기"
          data-playlist-rename
          @click="renaming = true"
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :disabled="busy"
          aria-label="재생목록 지우기"
          title="재생목록 지우기"
          data-playlist-delete
          @click="confirming = true"
        >
          <Trash2 />
        </Button>
      </div>
    </div>

    <p v-if="!canPlay" class="text-muted-foreground text-sm">
      재생하려면 재생 제어 탭의 보이스 카드에서 봇을 통화방에 참여시키세요.
    </p>

    <form class="flex gap-2" @submit.prevent="addTyped">
      <Input
        v-model="typed"
        maxlength="500"
        placeholder="곡 제목이나 링크를 입력해 담기…"
        aria-label="곡 제목이나 링크"
        class="min-w-0 flex-1"
        data-playlist-typed
      />
      <Button
        type="submit"
        variant="outline"
        :disabled="busy || !typed.trim()"
        data-playlist-typed-add
      >
        <Plus />
        담기
      </Button>
    </form>

    <p v-if="playlist.items.length === 0" class="text-muted-foreground text-sm">
      아직 곡이 없습니다. 위에서 입력하거나, 재생 제어 탭의 곡·대기열·최근 재생·검색 결과에서
      담으세요.
    </p>
    <ol v-else class="flex list-none flex-col gap-1 p-0" data-playlist-items>
      <li
        v-for="(item, index) in playlist.items"
        :key="item.id"
        class="hover:bg-muted/50 flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5"
        data-playlist-item
      >
        <span class="text-muted-foreground tnum w-6 shrink-0 text-right text-xs">{{
          index + 1
        }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm" :title="item.title">{{ item.title }}</p>
          <p
            v-if="item.typed && item.request !== item.title"
            class="text-muted-foreground truncate text-xs"
          >
            입력: {{ item.request }}
          </p>
        </div>
        <span v-if="item.durationSec" class="text-muted-foreground tnum shrink-0 text-xs">
          {{ formatSeconds(item.durationSec) }}
        </span>
        <div class="flex shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="busy || index === 0"
            aria-label="위로"
            @click="emit('moveItem', item.id, index - 1)"
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="busy || index === playlist.items.length - 1"
            aria-label="아래로"
            @click="emit('moveItem', item.id, index + 1)"
          >
            <ArrowDown />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="busy"
            aria-label="빼기"
            data-playlist-item-remove
            @click="emit('removeItem', item.id)"
          >
            <X />
          </Button>
        </div>
      </li>
    </ol>

    <PlaylistNameDialog
      v-model:open="renaming"
      title="이름 바꾸기"
      :initial="props.playlist.name"
      :busy="busy"
      @submit="rename"
    />
    <Dialog v-model:open="confirming">
      <DialogContent class="sm:max-w-md" data-playlist-delete-dialog>
        <DialogHeader>
          <DialogTitle>재생목록 지우기</DialogTitle>
          <DialogDescription>
            "{{ playlist.name }}"과 담긴 {{ playlist.itemCount }}곡을 지웁니다. 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="confirming = false">취소</Button>
          <Button variant="destructive" data-playlist-delete-confirm @click="confirmRemove">
            지우기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
