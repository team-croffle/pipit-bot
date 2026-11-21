<script setup lang="ts">
  import { ChevronDown, History } from 'lucide-vue-next';
  import { computed, ref, watch } from 'vue';
  import { useI18n } from 'vue-i18n';

  import { fetchJson } from '@/api';
  import AddToPlaylist from '@/components/music/playlists/add-to-playlist.vue';
  import { Button } from '@/components/ui/button';
  import type { HistoryTrack, PlaybackState } from '@/types';

  /**
   * The tracks this session has played, newest first. Folded by default — it is a look
   * back, not something to watch — and fetched only while open: whenever the playing
   * track changes, since that is when the history moves.
   */
  const { t } = useI18n();
  const props = defineProps<{ playback: PlaybackState | null }>();

  const open = ref(false);
  const tracks = ref<HistoryTrack[]>([]);
  const loading = ref(false);
  const error = ref('');

  async function load(): Promise<void> {
    loading.value = true;
    try {
      const body = await fetchJson<{ tracks: HistoryTrack[] }>('/api/music/playback/history');
      tracks.value = body.tracks;
      error.value = '';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : t('music.recent.loadFailed');
    } finally {
      loading.value = false;
    }
  }

  // A string, so a poll that changes nothing does not count as a change.
  const moment = computed(
    () => `${props.playback?.current?.title ?? ''}|${props.playback?.hasPrevious ?? false}`,
  );

  watch(moment, () => {
    if (open.value) {
      void load();
    }
  });

  function toggle(): void {
    open.value = !open.value;
    if (open.value) {
      void load();
    }
  }
</script>

<template>
  <div class="flex flex-col gap-2 border-t pt-3">
    <Button
      data-history-toggle
      variant="ghost"
      size="sm"
      class="self-start"
      :aria-expanded="open"
      @click="toggle"
    >
      <History />
      {{ t('music.recent.title') }}
      <ChevronDown class="transition-transform" :class="open ? 'rotate-180' : ''" />
    </Button>
    <template v-if="open">
      <p v-if="error" class="text-destructive text-xs" role="alert">{{ error }}</p>
      <p v-else-if="loading && !tracks.length" class="text-muted-foreground text-xs">
        {{ t('common.loading') }}
      </p>
      <p v-else-if="!tracks.length" class="text-muted-foreground text-xs">
        {{ t('music.recent.empty') }}
      </p>
      <ol v-else class="flex max-h-48 list-none flex-col overflow-y-auto p-0">
        <li
          v-for="track in tracks"
          :key="track.id"
          data-history-row
          class="text-muted-foreground flex items-center gap-3 py-1 text-sm"
        >
          <span class="min-w-0 flex-1 truncate">{{ track.title }}</span>
          <span v-if="track.duration" class="tnum shrink-0 text-xs">{{ track.duration }}</span>
          <AddToPlaylist :source="{ from: 'recent', ref: track.id }" size="xs" />
        </li>
      </ol>
    </template>
  </div>
</template>
