<script setup lang="ts">
  import { SkipForward, Trash2, X } from 'lucide-vue-next';

  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import type { PlaybackRepeatMode, PlaybackState } from '@/types';

  defineProps<{ playback: PlaybackState | null; busy: boolean }>();

  const emit = defineEmits<{
    action: [path: string, body?: unknown];
    repeat: [mode: PlaybackRepeatMode];
  }>();

  const repeatModes: { value: PlaybackRepeatMode; label: string }[] = [
    { value: 'off', label: '끔' },
    { value: 'track', label: '한 곡' },
    { value: 'queue', label: '대기열' },
  ];
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">대기열</CardTitle>
      <CardAction>
        <Badge variant="outline" class="tnum">
          {{ playback?.pendingCount ?? 0 }}곡
          <template v-if="playback?.durationFormatted">
            · {{ playback.durationFormatted }}</template
          >
        </Badge>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <!-- A floor under the list so going from queued to empty, or back, does not
           yank the repeat controls up the page. -->
      <p v-if="!playback?.tracks.length" class="text-muted-foreground min-h-16 text-sm">
        대기열이 비어 있습니다.
      </p>
      <!-- Rows are addressed by the player's track id, not their number: the list can be
           a poll behind the queue, and "the 3rd track" may already be a different one. -->
      <ol
        v-else
        data-queue-list
        class="flex max-h-96 min-h-16 list-none flex-col gap-0.5 overflow-x-hidden overflow-y-auto p-0"
      >
        <li
          v-for="track in playback.tracks"
          :key="track.id"
          data-queue-row
          :data-track-id="track.id"
          class="group flex items-center gap-3 border-b py-1.5 text-sm last:border-b-0"
        >
          <span class="text-muted-foreground tnum w-5 shrink-0 text-right text-xs">
            {{ track.index }}
          </span>
          <span class="min-w-0 flex-1 truncate">{{ track.title }}</span>
          <span v-if="track.duration" class="text-muted-foreground tnum shrink-0 text-xs">
            {{ track.duration }}
          </span>
          <div class="flex shrink-0 items-center">
            <Button
              data-row-action="skipto"
              variant="ghost"
              size="icon-xs"
              :disabled="busy"
              :aria-label="`${track.index}번으로 건너뛰기`"
              :title="
                track.index > 1
                  ? `여기로 건너뛰기 — 앞의 ${track.index - 1}곡은 대기열에서 빠집니다`
                  : '여기로 건너뛰기'
              "
              @click="emit('action', '/api/music/playback/skipto', { trackId: track.id })"
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
              @click="emit('action', '/api/music/playback/remove', { trackId: track.id })"
            >
              <X />
            </Button>
          </div>
        </li>
      </ol>
      <p
        v-if="playback && playback.pendingCount > playback.tracks.length"
        class="text-muted-foreground text-xs"
      >
        대기열에 {{ playback.pendingCount - playback.tracks.length }}곡 더 있습니다
      </p>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-muted-foreground mr-1 text-sm">반복</span>
          <Button
            v-for="mode in repeatModes"
            :key="mode.value"
            size="sm"
            :variant="playback?.repeatMode === mode.value ? 'default' : 'outline'"
            :disabled="busy"
            @click="emit('repeat', mode.value)"
          >
            {{ mode.label }}
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          :disabled="busy || !playback?.active || playback.pendingCount === 0"
          @click="emit('action', '/api/music/playback/clear')"
        >
          <Trash2 />
          비우기
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
