<script setup lang="ts">
  import { ArrowDown, ArrowUp, Ellipsis, SkipForward, X } from 'lucide-vue-next';
  import { computed } from 'vue';

  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import type { PlaybackTrackItem } from '@/types';

  /**
   * One waiting track and what can be done to it. Rows are addressed by the player's
   * track id, never their number: the list can be a poll behind the queue, and "the
   * 3rd track" may already be a different one.
   *
   * WHY a menu on phones: four icon buttons left a title of a few letters at 375px, and
   * the title is what the row is for. From `sm` up the buttons sit in the row.
   */
  const props = defineProps<{ track: PlaybackTrackItem; last: boolean; busy: boolean }>();

  const emit = defineEmits<{ action: [path: string, body?: unknown] }>();

  // A row keeps its component as the queue moves (keyed by id), so its number can change.
  const skipTitle = computed(() =>
    props.track.index > 1
      ? `여기로 건너뛰기 — 앞의 ${props.track.index - 1}곡은 대기열에서 빠집니다`
      : '여기로 건너뛰기',
  );

  function move(by: -1 | 1): void {
    emit('action', '/api/music/playback/move', {
      trackId: props.track.id,
      to: props.track.index + by,
    });
  }

  function skipTo(): void {
    emit('action', '/api/music/playback/skipto', { trackId: props.track.id });
  }

  function remove(): void {
    emit('action', '/api/music/playback/remove', { trackId: props.track.id });
  }
</script>

<template>
  <li
    data-queue-row
    :data-track-id="track.id"
    class="flex items-center gap-3 border-b py-1.5 text-sm last:border-b-0"
  >
    <span class="text-muted-foreground tnum w-5 shrink-0 text-right text-xs">
      {{ track.index }}
    </span>
    <span class="min-w-0 flex-1 truncate">{{ track.title }}</span>
    <span v-if="track.duration" class="text-muted-foreground tnum shrink-0 text-xs">
      {{ track.duration }}
    </span>

    <div class="hidden shrink-0 items-center sm:flex">
      <Button
        data-row-action="up"
        variant="ghost"
        size="icon-xs"
        :disabled="busy || track.index === 1"
        :aria-label="`${track.index}번 위로`"
        title="위로"
        @click="move(-1)"
      >
        <ArrowUp />
      </Button>
      <Button
        data-row-action="down"
        variant="ghost"
        size="icon-xs"
        :disabled="busy || last"
        :aria-label="`${track.index}번 아래로`"
        title="아래로"
        @click="move(1)"
      >
        <ArrowDown />
      </Button>
      <Button
        data-row-action="skipto"
        variant="ghost"
        size="icon-xs"
        :disabled="busy"
        :aria-label="`${track.index}번으로 건너뛰기`"
        :title="skipTitle"
        @click="skipTo"
      >
        <SkipForward />
      </Button>
      <Button
        data-row-action="remove"
        variant="ghost"
        size="icon-xs"
        :disabled="busy"
        :aria-label="`${track.index}번 삭제`"
        title="대기열에서 빼기"
        @click="remove"
      >
        <X />
      </Button>
    </div>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          data-row-menu
          variant="ghost"
          size="icon-xs"
          class="shrink-0 sm:hidden"
          :disabled="busy"
          :aria-label="`${track.index}번 메뉴`"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem :disabled="track.index === 1" @select="move(-1)">
          <ArrowUp />
          위로
        </DropdownMenuItem>
        <DropdownMenuItem :disabled="last" @select="move(1)">
          <ArrowDown />
          아래로
        </DropdownMenuItem>
        <DropdownMenuItem @select="skipTo">
          <SkipForward />
          여기로 건너뛰기
        </DropdownMenuItem>
        <DropdownMenuItem @select="remove">
          <X />
          빼기
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </li>
</template>
