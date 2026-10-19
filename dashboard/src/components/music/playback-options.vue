<script setup lang="ts">
  import { computed } from 'vue';

  import { Button } from '@/components/ui/button';
  import { Card, CardContent } from '@/components/ui/card';
  import { Label } from '@/components/ui/label';
  import { Switch } from '@/components/ui/switch';
  import type { PlaybackState } from '@/types';

  const { playback, busy, error } = defineProps<{
    playback: PlaybackState | null;
    busy: boolean;
    error: string;
  }>();

  const emit = defineEmits<{ action: [path: string, body?: unknown] }>();

  /** Unknown (no list from the worker) counts as offered, as everywhere else. */
  const autoplayOffered = computed(
    () => !playback?.capabilities || playback.capabilities.includes('related'),
  );

  const repeatModes = [
    { value: 'off', label: '끔' },
    { value: 'track', label: '한 곡' },
    { value: 'queue', label: '대기열' },
  ] as const;

  function setRepeatDefault(mode: 'off' | 'track' | 'queue') {
    if (playback && playback.repeatDefault !== mode) {
      emit('action', '/api/music/playback/options', { repeatDefault: mode });
    }
  }

  function setMono(on: boolean) {
    if (playback && playback.mono !== on) {
      emit('action', '/api/music/playback/options', { mono: on });
    }
  }

  function setAutoplay(on: boolean) {
    if (playback && playback.autoplay !== on) {
      emit('action', '/api/music/playback/options', { autoplay: on });
    }
  }
</script>

<template>
  <Card>
    <CardContent class="flex flex-col">
      <div
        class="flex items-center justify-between gap-4 border-b py-4 first:pt-0 last:border-b-0 last:pb-0"
      >
        <div class="min-w-0">
          <Label for="opt-mono">모노</Label>
          <p class="text-muted-foreground mt-1 text-xs">
            좌우 소리를 합쳐 양쪽에 똑같이 내보냅니다. 이어폰을 한쪽만 낄 때 켜 두세요. 재생 중인
            곡에도 바로 적용됩니다.
          </p>
          <p v-if="error" class="text-destructive mt-1 text-xs" data-options-error>{{ error }}</p>
        </div>
        <Switch
          id="opt-mono"
          data-option="mono"
          :model-value="playback?.mono ?? false"
          :disabled="!playback || busy"
          @update:model-value="(value) => setMono(value === true)"
        />
      </div>
      <div
        class="flex items-center justify-between gap-4 border-b py-4 first:pt-0 last:border-b-0 last:pb-0"
      >
        <div class="min-w-0">
          <Label for="opt-autoplay" :class="autoplayOffered ? '' : 'text-muted-foreground'">
            자동 재생
          </Label>
          <p class="text-muted-foreground mt-1 text-xs">
            {{
              autoplayOffered
                ? '대기열의 마지막 곡이 끝나 가면 music worker가 고른 비슷한 곡을 이어서 재생합니다. 그 사이 누가 곡을 넣으면 그 곡이 먼저입니다. 반복이 켜져 있거나 재생목록을 재생하는 동안은 쉬어요.'
                : '지금 music worker는 다음 곡 추천을 지원하지 않습니다.'
            }}
          </p>
        </div>
        <Switch
          id="opt-autoplay"
          data-option="autoplay"
          :model-value="playback?.autoplay ?? false"
          :disabled="!playback || busy || (!autoplayOffered && !playback.autoplay)"
          @update:model-value="(value) => setAutoplay(value === true)"
        />
      </div>
      <div
        class="flex flex-col gap-3 border-b py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0">
          <Label>반복 재생 기본값</Label>
          <p class="text-muted-foreground mt-1 text-xs">
            새 세션이 시작될 때의 반복 모드입니다. 지금 재생 중인 대기열은 그대로입니다. 반복이 켜져
            있으면 자동 재생은 쉽니다.
          </p>
        </div>
        <div class="flex shrink-0 gap-1.5" role="group" aria-label="반복 재생 기본값">
          <Button
            v-for="mode in repeatModes"
            :key="mode.value"
            size="sm"
            :data-repeat-default="mode.value"
            :variant="playback?.repeatDefault === mode.value ? 'default' : 'outline'"
            :aria-pressed="playback?.repeatDefault === mode.value"
            :disabled="!playback || busy"
            @click="setRepeatDefault(mode.value)"
          >
            {{ mode.label }}
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
