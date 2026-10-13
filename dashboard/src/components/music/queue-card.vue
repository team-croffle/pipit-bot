<script setup lang="ts">
  import { Shuffle, Trash2 } from 'lucide-vue-next';

  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import type { PlaybackRepeatMode, PlaybackState } from '@/types';

  import AddToPlaylist from './playlists/add-to-playlist.vue';
  import QueueRow from './queue-row.vue';
  import RecentTracks from './recent-tracks.vue';

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
      <CardAction class="flex items-center gap-2">
        <AddToPlaylist
          v-if="playback?.tracks.length"
          :source="{ from: 'queue', ref: 'all' }"
          label="전체 담기"
          :disabled="busy"
        />
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
      <ol
        v-else
        data-queue-list
        class="flex max-h-96 min-h-16 list-none flex-col gap-0.5 overflow-x-hidden overflow-y-auto p-0"
      >
        <QueueRow
          v-for="(track, i) in playback.tracks"
          :key="track.id"
          :track="track"
          :last="i === playback.tracks.length - 1"
          :busy="busy"
          @action="(path, body) => emit('action', path, body)"
        />
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
        <div class="flex items-center gap-1.5">
          <Button
            data-queue-shuffle
            variant="outline"
            size="sm"
            :disabled="busy || (playback?.pendingCount ?? 0) < 2"
            title="대기열을 한 번 섞습니다"
            @click="emit('action', '/api/music/playback/shuffle')"
          >
            <Shuffle />
            섞기
          </Button>
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
      </div>

      <RecentTracks :playback="playback" />
    </CardContent>
  </Card>
</template>
