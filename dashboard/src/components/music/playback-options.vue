<script setup lang="ts">
  import { computed } from 'vue';
  import { useI18n } from 'vue-i18n';

  import { Button } from '@/components/ui/button';
  import { Card, CardContent } from '@/components/ui/card';
  import { Label } from '@/components/ui/label';
  import { Switch } from '@/components/ui/switch';
  import type { PlaybackState } from '@/types';

  const { t } = useI18n();
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

  const repeatModes = ['off', 'track', 'queue'] as const;

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
          <Label for="opt-mono">{{ t('music.options.mono') }}</Label>
          <p class="text-muted-foreground mt-1 text-xs">
            {{ t('music.options.monoHint') }}
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
            {{ t('music.autoplay') }}
          </Label>
          <p class="text-muted-foreground mt-1 text-xs">
            {{
              autoplayOffered
                ? t('music.options.autoplayHint')
                : t('music.options.autoplayUnsupported')
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
          <Label>{{ t('music.options.repeatDefault') }}</Label>
          <p class="text-muted-foreground mt-1 text-xs">
            {{ t('music.options.repeatDefaultHint') }}
          </p>
        </div>
        <div
          class="flex shrink-0 gap-1.5"
          role="group"
          :aria-label="t('music.options.repeatDefault')"
        >
          <Button
            v-for="mode in repeatModes"
            :key="mode"
            size="sm"
            :data-repeat-default="mode"
            :variant="playback?.repeatDefault === mode ? 'default' : 'outline'"
            :aria-pressed="playback?.repeatDefault === mode"
            :disabled="!playback || busy"
            @click="setRepeatDefault(mode)"
          >
            {{ t(`music.repeatMode.${mode}`) }}
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
