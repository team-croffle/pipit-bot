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
      return '위에서 추가하거나 디스코드 명령을 사용하세요.';
    }

    const where = props.playback?.voiceChannelName
      ? `#${props.playback.voiceChannelName} 재생 중`
      : '재생 중';
    return where;
  });

  // Priority, not stacking: an error is the thing to read, then the player's own
  // notice, then whatever the last action reported, then why enqueueing is unavailable.
  const status = computed(() => {
    if (props.error) {
      return props.error;
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

    return props.playback && !props.playback.canEnqueue
      ? '트랙을 추가하려면 보이스 카드에서 봇을 통화방에 참여시키세요.'
      : '';
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

  const statusLabel: Record<PlaybackStatus, string> = {
    loading: '준비 중',
    playing: '재생 중',
    paused: '일시정지',
    ready: '대기',
    idle: '유휴',
  };

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
          placeholder="검색어나 링크를 입력하세요…"
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
            재생
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                type="button"
                data-enqueue-menu
                size="icon"
                class="border-primary-foreground/20 rounded-l-none border-l"
                :disabled="cannotAdd"
                aria-label="추가 방법 선택"
                title="추가 방법 선택"
              >
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @select="submit(true)">
                <ListStart />
                다음에 재생
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
        :class="error ? 'text-destructive' : 'text-muted-foreground'"
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
              {{ current?.title ?? '재생 중인 트랙이 없습니다' }}
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
              자동 재생
            </span>
          </p>
          <Progress
            data-now-progress
            class="mt-3 h-1.5"
            :model-value="progress"
            :aria-label="current ? `${Math.round(progress)}% 재생` : '재생 중인 트랙 없음'"
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
          {{ playback ? statusLabel[playback.status] : '…' }}
        </Badge>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-2.5" data-now-controls>
        <Button
          variant="outline"
          size="icon"
          class="rounded-full"
          :class="playback && playback.repeatMode !== 'off' ? 'border-primary text-primary' : ''"
          :disabled="busy"
          :aria-label="`반복 재생: ${playback?.repeatMode ?? 'off'}`"
          :title="`반복 재생: ${playback?.repeatMode ?? 'off'}`"
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
          aria-label="이전 트랙"
          title="이전 트랙 — 지금 곡은 대기열 맨 앞으로"
          @click="emit('action', '/api/music/playback/back')"
        >
          <SkipBack />
        </Button>
        <Button
          v-if="playback?.paused"
          size="icon-lg"
          class="rounded-full"
          :disabled="busy || !playback.active"
          aria-label="재개"
          @click="emit('action', '/api/music/playback/resume')"
        >
          <Play />
        </Button>
        <Button
          v-else
          size="icon-lg"
          class="rounded-full"
          :disabled="busy || !playback?.active"
          aria-label="일시정지"
          @click="emit('action', '/api/music/playback/pause')"
        >
          <Pause />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="rounded-full"
          :disabled="busy || !playback?.active"
          aria-label="다음 트랙"
          @click="emit('action', '/api/music/playback/skip')"
        >
          <SkipForward />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="rounded-full"
          :disabled="busy || !playback?.active"
          aria-label="정지하고 나가기"
          @click="emit('action', '/api/music/playback/stop')"
        >
          <Square />
        </Button>
        <AddToPlaylist :source="{ from: 'current' }" :disabled="busy || !current" control />
      </div>
    </CardContent>
  </Card>
</template>
