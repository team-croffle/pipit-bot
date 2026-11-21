<script setup lang="ts">
  import {
    Bot,
    ChevronDown,
    ListStart,
    Music,
    Pause,
    Play,
    Repeat,
    SkipBack,
    SkipForward,
    Square,
  } from 'lucide-vue-next';
  import { computed, ref } from 'vue';
  import { useI18n } from 'vue-i18n';

  import AddToPlaylist from '@/components/music/playlists/add-to-playlist.vue';
  import SearchDialog from '@/components/music/search-dialog.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent } from '@/components/ui/card';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Input } from '@/components/ui/input';
  import { Progress } from '@/components/ui/progress';
  import { playlistFeedback } from '@/composables/use-playlist-saver';
  import type { PlaybackRepeatMode, PlaybackState, PlaybackStatus } from '@/types';

  const { t } = useI18n();
  const props = defineProps<{
    playback: PlaybackState | null;
    busy: boolean;
    error: string;
    message: string;
  }>();

  const current = computed(() =>
    props.playback?.active ? (props.playback.current ?? null) : null,
  );

  /** A percentage with two decimals — whole steps made the bar jump once every few seconds. */
  const progress = computed(() => Math.round((current.value?.progress ?? 0) * 10_000) / 100);

  const subtitle = computed(() => {
    if (!current.value) {
      return t('music.now.hint');
    }

    const where = props.playback?.voiceChannelName
      ? t('music.now.playingIn', { channel: props.playback.voiceChannelName })
      : t('music.status.playing');
    return where;
  });

  const workerDown = computed(() => props.playback?.worker?.status === 'down');

  /** How long the worker has been down, by the poll that brought it. */
  function downFor(since: number | null | undefined): string {
    const minutes = since ? Math.floor((Date.now() - since) / 60_000) : 0;
    if (minutes < 1) {
      return t('music.now.downJustNow');
    }

    return minutes < 60
      ? t('music.now.downMinutes', { minutes })
      : t('music.now.downHours', { hours: Math.floor(minutes / 60) });
  }

  // Priority, not stacking: an error is the thing to read, then a music worker that is
  // down (nothing new can be prepared), then the player's own notice, then whatever the
  // last action reported, then why enqueueing is unavailable.
  const status = computed(() => {
    if (props.error) {
      return props.error;
    }

    // Adding stays possible — a worker that has just come back takes the request — but
    // this says why it will most likely fail. It goes away on the poll after it is back.
    if (workerDown.value) {
      return t('music.now.workerDown', { since: downFor(props.playback?.worker?.since) });
    }

    // Something the player did on its own (a track skipped for a missing file) is
    // news the last action's own reply is not.
    if (props.playback?.notice) {
      return props.playback.notice.message;
    }

    // A save to a playlist is the newest thing the person did, for a few seconds.
    const saved = playlistFeedback.value;
    if (saved && Date.now() - saved.at < 8000) {
      return saved.message;
    }

    if (props.message) {
      return props.message;
    }

    return props.playback && !props.playback.canEnqueue ? t('music.now.joinFirst') : '';
  });

  const emit = defineEmits<{
    action: [path: string];
    repeat: [mode: PlaybackRepeatMode];
    enqueue: [query: string, next: boolean];
    searched: [];
  }>();

  const query = ref('');

  const statusVariant: Record<PlaybackStatus, 'default' | 'secondary' | 'outline'> = {
    loading: 'secondary',
    playing: 'default',
    paused: 'secondary',
    ready: 'outline',
    idle: 'outline',
  };

  function statusLabel(state: PlaybackStatus): string {
    return t(`music.status.${state}`);
  }

  // `off` and `track` are the two the button cycles between when nothing is queued;
  // the full set lives in the queue card's repeat control.
  function cycleRepeat(): void {
    const mode = props.playback?.repeatMode ?? 'off';
    const next: PlaybackRepeatMode = mode === 'off' ? 'track' : mode === 'track' ? 'queue' : 'off';
    emit('repeat', next);
  }

  const cannotAdd = computed(
    () => !props.playback?.canEnqueue || props.busy || !query.value.trim(),
  );

  function submit(next = false): void {
    if (!query.value.trim()) {
      return;
    }

    emit('enqueue', query.value, next);
    query.value = '';
  }
</script>

<template>
  <Card>
    <CardContent class="flex flex-col gap-5">
      <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="submit()">
        <Input
          id="enqueue-query"
          v-model="query"
          type="text"
          :placeholder="t('music.now.queryPlaceholder')"
          class="flex-1"
          :disabled="!playback?.canEnqueue || busy"
        />
        <!-- A split button: the plain action stays one click, and "play next" — the
             dashboard side of !playnext — sits one step away instead of beside it as a
             second primary button. -->
        <div class="flex">
          <Button
            type="submit"
            data-enqueue-submit
            class="flex-1 rounded-r-none"
            :disabled="cannotAdd"
          >
            <Play />
            {{ t('music.now.play') }}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                type="button"
                data-enqueue-menu
                size="icon"
                class="border-primary-foreground/20 rounded-l-none border-l"
                :disabled="cannotAdd"
                :aria-label="t('music.now.addMode')"
                :title="t('music.now.addMode')"
              >
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @select="submit(true)">
                <ListStart />
                {{ t('music.now.playNext') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <SearchDialog
          v-if="!playback?.capabilities || playback.capabilities.includes('search')"
          :can-enqueue="Boolean(playback?.canEnqueue)"
          @added="emit('searched')"
        />
      </form>

      <!-- One reserved line for all three notices: they used to be separate paragraphs
           that appeared and vanished, and every appearance resized the card. -->
      <p
        data-playback-status
        class="min-h-5 text-sm"
        :class="error ? 'text-destructive' : workerDown ? 'text-warning' : 'text-muted-foreground'"
        :role="error ? 'alert' : undefined"
        aria-live="polite"
      >
        {{ status }}
      </p>

      <div class="flex min-h-24 items-start gap-4">
        <div
          class="from-primary/80 to-primary/30 text-primary-foreground flex size-14 shrink-0 items-center justify-center rounded-xl bg-linear-to-br"
          aria-hidden="true"
        >
          <Music class="size-6" />
        </div>
        <!-- Both states render the same rows — the idle one just has nothing to say in
             them. Two branches of different heights made the card resize on every
             track change and on every poll that arrived mid-transition. -->
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-1">
            <p
              class="min-w-0 truncate font-semibold"
              :class="current ? '' : 'text-muted-foreground'"
            >
              {{ current?.title ?? t('music.now.nothingPlaying') }}
            </p>
          </div>
          <p class="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
            <span class="truncate">{{ subtitle }}</span>
            <span
              v-if="current?.autoplay"
              class="inline-flex shrink-0 items-center gap-1"
              data-autoplay-current
            >
              <Bot class="size-4" aria-hidden="true" />
              {{ t('music.autoplay') }}
            </span>
          </p>
          <Progress
            data-now-progress
            class="mt-3 h-1.5"
            :model-value="progress"
            :aria-label="
              current
                ? t('music.now.progress', { percent: Math.round(progress) })
                : t('music.now.noTrack')
            "
          />
          <p class="text-muted-foreground tnum mt-1.5 flex justify-between text-xs">
            <span>{{ current?.positionLabel ?? '--:--' }}</span>
            <span>{{ current?.durationLabel ?? '--:--' }}</span>
          </p>
        </div>
        <!-- Reserved so the title does not widen for one poll while state is unknown. -->
        <Badge
          :variant="playback ? statusVariant[playback.status] : 'outline'"
          class="mt-0.5 min-w-14 shrink-0 justify-center"
        >
          {{ playback ? statusLabel(playback.status) : '…' }}
        </Badge>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-2.5" data-now-controls>
        <Button
          variant="outline"
          size="icon"
          class="rounded-full"
          :class="playback && playback.repeatMode !== 'off' ? 'border-primary text-primary' : ''"
          :disabled="busy"
          :aria-label="t('music.now.repeat', { mode: playback?.repeatMode ?? 'off' })"
          :title="t('music.now.repeat', { mode: playback?.repeatMode ?? 'off' })"
          @click="cycleRepeat"
        >
          <Repeat />
        </Button>
        <Button
          data-playback-back
          variant="outline"
          size="icon"
          class="rounded-full"
          :disabled="busy || !playback?.hasPrevious"
          :aria-label="t('music.now.previous')"
          :title="t('music.now.previousHint')"
          @click="emit('action', '/api/music/playback/back')"
        >
          <SkipBack />
        </Button>
        <Button
          v-if="playback?.paused"
          size="icon-lg"
          class="rounded-full"
          :disabled="busy || !playback.active"
          :aria-label="t('music.now.resume')"
          @click="emit('action', '/api/music/playback/resume')"
        >
          <Play />
        </Button>
        <Button
          v-else
          size="icon-lg"
          class="rounded-full"
          :disabled="busy || !playback?.active"
          :aria-label="t('music.status.paused')"
          @click="emit('action', '/api/music/playback/pause')"
        >
          <Pause />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="rounded-full"
          :disabled="busy || !playback?.active"
          :aria-label="t('music.now.next')"
          @click="emit('action', '/api/music/playback/skip')"
        >
          <SkipForward />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="rounded-full"
          :disabled="busy || !playback?.active"
          :aria-label="t('music.now.stop')"
          @click="emit('action', '/api/music/playback/stop')"
        >
          <Square />
        </Button>
        <AddToPlaylist :source="{ from: 'current' }" :disabled="busy || !current" control />
      </div>
    </CardContent>
  </Card>
</template>
