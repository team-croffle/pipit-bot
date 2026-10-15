<script setup lang="ts">
  import { Badge } from '@/components/ui/badge';
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

  /** Options that are not built yet — each one is tied to a roadmap version. */
  const planned = [
    {
      key: 'autoplay',
      label: '자동 재생',
      help: '대기열이 끝나 가면 music worker가 고른 비슷한 곡을 이어서 재생합니다.',
      version: 'v0.7.5',
    },
    {
      key: 'repeat-default',
      label: '반복 재생 기본값',
      help: '새 세션이 시작될 때 적용할 반복 모드입니다.',
      version: 'v0.7.6',
    },
  ];

  function setMono(on: boolean) {
    if (playback && playback.mono !== on) {
      emit('action', '/api/music/playback/options', { mono: on });
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
        v-for="option in planned"
        :key="option.key"
        class="flex items-center justify-between gap-4 border-b py-4 first:pt-0 last:border-b-0 last:pb-0"
      >
        <div class="min-w-0">
          <Label :for="`opt-${option.key}`" class="text-muted-foreground">{{ option.label }}</Label>
          <p class="text-muted-foreground mt-1 text-xs">{{ option.help }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2.5">
          <Badge variant="secondary">{{ option.version }} 예정</Badge>
          <Switch :id="`opt-${option.key}`" disabled />
        </div>
      </div>
    </CardContent>
  </Card>
</template>
