<script setup lang="ts">
  import { Trash2 } from 'lucide-vue-next';

  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import type { PlaybackRepeatMode, PlaybackState } from '@/types';

  defineProps<{ playback: PlaybackState | null; busy: boolean }>();

  const emit = defineEmits<{ action: [path: string]; repeat: [mode: PlaybackRepeatMode] }>();

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
      <ol v-else class="flex min-h-16 list-none flex-col gap-0.5 p-0">
        <li
          v-for="track in playback.tracks"
          :key="track.index"
          class="flex items-center gap-3 border-b py-2 text-sm last:border-b-0"
        >
          <span class="text-muted-foreground tnum w-5 shrink-0 text-right text-xs">
            {{ track.index }}
          </span>
          <span class="min-w-0 flex-1 truncate">{{ track.title }}</span>
          <span v-if="track.duration" class="text-muted-foreground tnum shrink-0 text-xs">
            {{ track.duration }}
          </span>
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
