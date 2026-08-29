<script setup lang="ts">
  import { Music, Pause, Play, Repeat, SkipForward, Square } from 'lucide-vue-next';
  import { ref } from 'vue';

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
    const current = props.playback?.repeatMode ?? 'off';
    const next: PlaybackRepeatMode =
      current === 'off' ? 'track' : current === 'track' ? 'queue' : 'off';
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

      <p v-if="playback && !playback.canEnqueue" class="text-muted-foreground text-sm">
        트랙을 추가하려면 먼저 봇을 보이스 채널에 참여시키세요.
      </p>
      <p v-if="error" class="text-destructive text-sm" role="alert">{{ error }}</p>
      <p v-else-if="message" class="text-muted-foreground text-sm">{{ message }}</p>

      <div class="flex items-start gap-4">
        <div
          class="from-primary/80 to-primary/30 text-primary-foreground flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br"
          aria-hidden="true"
        >
          <Music class="size-6" />
        </div>
        <div class="min-w-0 flex-1">
          <template v-if="playback?.active && playback.current">
            <p class="truncate font-semibold">{{ playback.current.title }}</p>
            <p class="text-muted-foreground mt-0.5 truncate text-xs">
              <template v-if="playback.voiceChannelName">
                #{{ playback.voiceChannelName }} 재생 중
              </template>
              <template v-else>music worker 소스</template>
            </p>
            <div
              class="bg-muted mt-3 h-1.5 overflow-hidden rounded-full"
              role="progressbar"
              :aria-valuenow="Math.round(playback.current.progress * 100)"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="bg-primary h-full rounded-full transition-[width] duration-300"
                :style="{ width: `${Math.round(playback.current.progress * 100)}%` }"
              />
            </div>
            <p class="text-muted-foreground tnum mt-1.5 flex justify-between text-xs">
              <span>{{ playback.current.positionLabel }}</span>
              <span>{{ playback.current.durationLabel }}</span>
            </p>
          </template>
          <template v-else>
            <p class="text-muted-foreground font-medium">재생 중인 트랙이 없습니다</p>
            <p class="text-muted-foreground mt-0.5 text-xs">
              위에서 추가하거나 디스코드 명령을 사용하세요.
            </p>
          </template>
        </div>
        <Badge v-if="playback" :variant="statusVariant[playback.status]" class="mt-0.5 shrink-0">
          {{ statusLabel[playback.status] }}
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
