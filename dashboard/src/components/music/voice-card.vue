<script setup lang="ts">
  import { Volume2 } from 'lucide-vue-next';

  import { Badge } from '@/components/ui/badge';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Label } from '@/components/ui/label';
  import type { PlaybackState } from '@/types';

  defineProps<{ playback: PlaybackState | null }>();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">보이스 · 볼륨</CardTitle>
      <CardDescription>봇이 접속한 통화방과 출력 볼륨</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-5">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm">통화방</span>
        <Badge v-if="playback?.voiceChannelName" variant="outline">
          #{{ playback.voiceChannelName }}
        </Badge>
        <span v-else class="text-muted-foreground text-sm">참여 중이 아님</span>
      </div>

      <div class="flex flex-col gap-2 border-t pt-4">
        <div class="flex items-center justify-between gap-3">
          <Label for="volume" class="text-muted-foreground inline-flex items-center gap-1.5">
            <Volume2 class="size-3.5" />
            볼륨
          </Label>
          <Badge variant="secondary">v0.7.4 예정</Badge>
        </div>
        <!-- discord-player runs with `disableVolume: true` today, so this stays inert
             until the player option is turned on (ROADMAP v0.7.4). -->
        <input
          id="volume"
          type="range"
          min="0"
          max="2"
          step="1"
          value="1"
          disabled
          class="accent-primary w-full opacity-50"
        />
        <div class="text-muted-foreground flex justify-between text-xs">
          <span>낮음</span>
          <span>중간</span>
          <span>높음</span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
