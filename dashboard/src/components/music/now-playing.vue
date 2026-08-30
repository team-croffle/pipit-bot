<script setup lang="ts">
  import { Music, Pause, Play, Repeat, SkipForward, Square } from 'lucide-vue-next';
  import { computed, ref } from 'vue';

  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
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

  const progress = computed(() => Math.round((current.value?.progress ?? 0) * 100));

  const subtitle = computed(() => {
    if (!current.value) {
      return '위에서 추가하거나 디스코드 명령을 사용하세요.';
    }

    return props.playback?.voiceChannelName
      ? `#${props.playback.voiceChannelName} 재생 중`
      : '재생 중';
  });

  // Priority, not stacking: an error is the thing to read, then whatever the last
  // action reported, then the reason enqueueing is unavailable.
  const status = computed(() => {
    if (props.error) {
      return props.error;
    }

    if (props.message) {
      return props.message;
    }

    return props.playback && !props.playback.canEnqueue
      ? '트랙을 추가하려면 먼저 봇을 보이스 채널에 참여시키세요.'
      : '';
  });

  const emit = defineEmits<{
    action: [path: string];
    repeat: [mode: PlaybackRepeatMode];
    enqueue: [query: string];
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

  function submit(): void {
    if (!query.value.trim()) {
      return;
    }

    emit('enqueue', query.value);
    query.value = '';
  }
</script>

<template>
  <Card>
    <CardContent class="flex flex-col gap-5">
      <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="submit">
        <Input
          v-model="query"
          type="text"
          placeholder="검색어나 링크를 입력하세요…"
          class="flex-1"
          :disabled="!playback?.canEnqueue || busy"
        />
        <Button type="submit" :disabled="!playback?.canEnqueue || busy || !query.trim()">
          <Play />
          재생
        </Button>
      </form>

      <!-- One reserved line for all three notices: they used to be separate paragraphs
           that appeared and vanished, and every appearance resized the card. -->
      <p
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
          <p class="truncate font-semibold" :class="current ? '' : 'text-muted-foreground'">
            {{ current?.title ?? '재생 중인 트랙이 없습니다' }}
          </p>
          <p class="text-muted-foreground mt-0.5 truncate text-xs">{{ subtitle }}</p>
          <div
            class="bg-muted mt-3 h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            :aria-valuenow="progress"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="bg-primary h-full rounded-full transition-[width] duration-300"
              :style="{ width: `${progress}%` }"
            />
          </div>
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

      <div class="flex items-center justify-center gap-2.5">
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
      </div>
    </CardContent>
  </Card>
</template>
