<script setup lang="ts">
  import { Pause, Play, Repeat, SkipForward, Square, Trash2 } from 'lucide-vue-next';
  import { onMounted, onUnmounted, ref } from 'vue';

  import { fetchJson, postJson } from '@/api';
  import StateBlock from '@/components/common/state-block.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Separator } from '@/components/ui/separator';
  import type {
    PlaybackActionResult,
    PlaybackRepeatMode,
    PlaybackState,
    PlaybackStatus,
  } from '@/types';

  const playback = ref<PlaybackState | null>(null);
  const query = ref('');
  const error = ref('');
  const actionMessage = ref('');
  const busy = ref(false);
  const loading = ref(true);
  let timer: ReturnType<typeof setInterval> | undefined;

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

  const loopModes: { value: PlaybackRepeatMode; label: string }[] = [
    { value: 'off', label: '끔' },
    { value: 'track', label: '한 곡' },
    { value: 'queue', label: '대기열' },
  ];

  function isRedirect(cause: unknown): boolean {
    return cause instanceof Error && cause.message.startsWith('Redirecting to login');
  }

  async function refresh(): Promise<void> {
    try {
      playback.value = await fetchJson<PlaybackState>('/api/music/playback');
      error.value = '';
    } catch (cause) {
      if (isRedirect(cause)) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '재생 상태를 불러오지 못했습니다.';
    } finally {
      loading.value = false;
    }
  }

  async function runAction(path: string): Promise<void> {
    busy.value = true;
    actionMessage.value = '';
    try {
      const result = await postJson<PlaybackActionResult>(path);
      actionMessage.value = result.message;
      error.value = result.ok ? '' : result.message;
      await refresh();
    } catch (cause) {
      if (isRedirect(cause)) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.';
    } finally {
      busy.value = false;
    }
  }

  async function setLoop(mode: PlaybackRepeatMode): Promise<void> {
    if (playback.value?.repeatMode === mode) {
      return;
    }

    busy.value = true;
    actionMessage.value = '';
    try {
      const result = await postJson<PlaybackActionResult>('/api/music/playback/loop', { mode });
      actionMessage.value = result.message;
      error.value = result.ok ? '' : result.message;
      await refresh();
    } catch (cause) {
      if (isRedirect(cause)) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '반복 모드를 바꾸지 못했습니다.';
    } finally {
      busy.value = false;
    }
  }

  async function enqueue(): Promise<void> {
    const trimmed = query.value.trim();
    if (!trimmed || !playback.value?.canEnqueue) {
      return;
    }

    busy.value = true;
    actionMessage.value = '';
    try {
      await postJson('/api/music/jobs', { jobId: crypto.randomUUID(), query: trimmed });
      query.value = '';
      actionMessage.value = '트랙을 준비하고 있습니다…';
      error.value = '';
      await refresh();
    } catch (cause) {
      if (isRedirect(cause)) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '대기열에 추가하지 못했습니다.';
    } finally {
      busy.value = false;
    }
  }

  onMounted(async () => {
    await refresh();
    timer = setInterval(() => {
      void refresh();
    }, 3000);
  });

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer);
    }
  });
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">재생</CardTitle>
      <CardAction>
        <Badge v-if="playback" :variant="statusVariant[playback.status]">
          {{ statusLabel[playback.status] }}
        </Badge>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <StateBlock :loading="loading">
        <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="enqueue">
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
        <p v-else-if="actionMessage" class="text-muted-foreground text-sm">{{ actionMessage }}</p>

        <div v-if="playback?.active && playback.current" class="flex flex-col gap-1.5">
          <p class="truncate font-medium">{{ playback.current.title }}</p>
          <div
            class="bg-muted h-1.5 overflow-hidden rounded-full"
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
          <p class="text-muted-foreground tnum flex justify-between text-xs">
            <span>{{ playback.current.positionLabel }}</span>
            <span>{{ playback.current.durationLabel }}</span>
          </p>
          <p v-if="playback.voiceChannelName" class="text-muted-foreground text-sm">
            보이스: {{ playback.voiceChannelName }}
          </p>
        </div>
        <p v-else class="text-muted-foreground text-sm">
          재생 중인 트랙이 없습니다. 위에서 추가하거나 디스코드 명령을 사용하세요.
        </p>

        <div class="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="busy || !playback?.active || playback.paused"
            @click="runAction('/api/music/playback/pause')"
          >
            <Pause />
            일시정지
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="busy || !playback?.active || !playback.paused"
            @click="runAction('/api/music/playback/resume')"
          >
            <Play />
            재개
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="busy || !playback?.active"
            @click="runAction('/api/music/playback/skip')"
          >
            <SkipForward />
            다음
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="busy || !playback?.active"
            @click="runAction('/api/music/playback/stop')"
          >
            <Square />
            정지
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="busy || !playback?.active || playback.pendingCount === 0"
            @click="runAction('/api/music/playback/clear')"
          >
            <Trash2 />
            대기열 비우기
          </Button>
        </div>

        <div v-if="playback?.active" class="flex flex-wrap items-center gap-2">
          <span class="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <Repeat class="size-3.5" />
            반복
          </span>
          <Button
            v-for="mode in loopModes"
            :key="mode.value"
            size="sm"
            :variant="playback.repeatMode === mode.value ? 'default' : 'outline'"
            :disabled="busy"
            @click="setLoop(mode.value)"
          >
            {{ mode.label }}
          </Button>
        </div>

        <template v-if="playback?.active">
          <Separator />
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-semibold">다음 트랙</h3>
              <span class="text-muted-foreground tnum text-xs">
                {{ playback.pendingCount }}곡
                <template v-if="playback.durationFormatted">
                  · {{ playback.durationFormatted }}
                </template>
              </span>
            </div>
            <p v-if="playback.tracks.length === 0" class="text-muted-foreground text-sm">
              대기열이 비어 있습니다.
            </p>
            <ol v-else class="flex list-none flex-col gap-1.5 p-0">
              <li
                v-for="track in playback.tracks"
                :key="track.index"
                class="flex items-center gap-3 text-sm"
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
              v-if="playback.pendingCount > playback.tracks.length"
              class="text-muted-foreground text-xs"
            >
              대기열에 {{ playback.pendingCount - playback.tracks.length }}곡 더 있습니다
            </p>
          </div>
        </template>
      </StateBlock>
    </CardContent>
  </Card>
</template>
