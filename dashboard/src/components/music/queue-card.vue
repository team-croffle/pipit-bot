<script setup lang="ts">
  import { Shuffle, Trash2 } from 'lucide-vue-next';
  import { useI18n } from 'vue-i18n';

  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import type { PlaybackRepeatMode, PlaybackState } from '@/types';

  import AddToPlaylist from './playlists/add-to-playlist.vue';
  import QueueRow from './queue-row.vue';
  import RecentTracks from './recent-tracks.vue';

  const { t } = useI18n();
  defineProps<{ playback: PlaybackState | null; busy: boolean }>();

  const emit = defineEmits<{
    action: [path: string, body?: unknown];
    repeat: [mode: PlaybackRepeatMode];
  }>();

  const repeatModes: PlaybackRepeatMode[] = ['off', 'track', 'queue'];
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">{{ t('music.queue.title') }}</CardTitle>
      <CardAction class="flex items-center gap-2">
        <AddToPlaylist
          v-if="playback?.tracks.length"
          :source="{ from: 'queue', ref: 'all' }"
          :label="t('music.queue.saveAll')"
          :disabled="busy"
        />
        <Badge variant="outline" class="tnum">
          {{
            t(
              'music.trackCount',
              { count: playback?.pendingCount ?? 0 },
              playback?.pendingCount ?? 0,
            )
          }}
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
        {{ t('music.queue.empty') }}
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
        {{
          t(
            'music.queue.more',
            { count: playback.pendingCount - playback.tracks.length },
            playback.pendingCount - playback.tracks.length,
          )
        }}
      </p>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-muted-foreground mr-1 text-sm">{{ t('music.queue.repeat') }}</span>
          <Button
            v-for="mode in repeatModes"
            :key="mode"
            size="sm"
            :variant="playback?.repeatMode === mode ? 'default' : 'outline'"
            :disabled="busy"
            @click="emit('repeat', mode)"
          >
            {{ t(`music.repeatMode.${mode}`) }}
          </Button>
        </div>
        <div class="flex items-center gap-1.5">
          <Button
            data-queue-shuffle
            variant="outline"
            size="sm"
            :disabled="busy || (playback?.pendingCount ?? 0) < 2"
            :title="t('music.queue.shuffleHint')"
            @click="emit('action', '/api/music/playback/shuffle')"
          >
            <Shuffle />
            {{ t('music.queue.shuffle') }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="busy || !playback?.active || playback.pendingCount === 0"
            @click="emit('action', '/api/music/playback/clear')"
          >
            <Trash2 />
            {{ t('music.queue.clear') }}
          </Button>
        </div>
      </div>

      <RecentTracks :playback="playback" />
    </CardContent>
  </Card>
</template>
