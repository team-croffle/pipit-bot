<script setup lang="ts">
  import { LogOut, Volume2 } from 'lucide-vue-next';
  import { computed, onMounted, ref, watch } from 'vue';

  import { fetchJson } from '@/api';
  import VoiceChannelSelect from '@/components/common/voice-channel-select.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Slider } from '@/components/ui/slider';
  import type { DiscordVoiceChannel, PlaybackState } from '@/types';

  const props = defineProps<{ playback: PlaybackState | null; busy: boolean }>();

  const emit = defineEmits<{ action: [path: string, body?: unknown] }>();

  const channels = ref<DiscordVoiceChannel[]>([]);
  const channelsLoading = ref(false);
  const channelsError = ref('');
  const target = ref('');

  /**
   * WHY the list is fetched again whenever the picker opens: the member counts are the
   * point of showing it — an empty room is one the player walks out of — and they
   * change by the minute. The first fetch happens on mount so the trigger can name the
   * room the bot is already in.
   */
  async function loadChannels(): Promise<void> {
    channelsLoading.value = true;
    try {
      const body = await fetchJson<{ channels: DiscordVoiceChannel[] }>(
        '/api/discord/voice-channels',
      );
      channels.value = body.channels;
      channelsError.value = '';
    } catch (cause) {
      channelsError.value =
        cause instanceof Error ? cause.message : '통화방 목록을 불러오지 못했습니다.';
    } finally {
      channelsLoading.value = false;
    }
  }

  onMounted(loadChannels);

  const joinedId = computed(() => props.playback?.voiceChannelId ?? null);

  // Follow the bot: when it joins, moves or leaves (here or by a command in Discord),
  // the picker shows where it is now instead of a choice made earlier.
  watch(
    joinedId,
    (id) => {
      target.value = id ?? '';
    },
    { immediate: true },
  );

  const chosen = computed(() => channels.value.find((channel) => channel.id === target.value));
  const emptyWarning = computed(
    () => chosen.value && chosen.value.id !== joinedId.value && chosen.value.memberCount === 0,
  );

  function join(): void {
    if (target.value && target.value !== joinedId.value) {
      emit('action', '/api/music/voice/join', { channelId: target.value });
    }
  }

  const MAX_VOLUME = 200;

  /**
   * What the slider and the box show. It follows the bot's value between polls, but not
   * while someone is dragging or typing — a poll landing mid-drag would yank it back.
   */
  const draft = ref(100);
  const editing = ref(false);
  watch(
    () => props.playback?.volume,
    (volume) => {
      if (volume !== undefined && !editing.value) {
        draft.value = volume;
      }
    },
    { immediate: true },
  );

  const boosted = computed(() => draft.value > 100);

  /** Sent once a change is settled: the thumb let go, or the box left or Enter pressed. */
  function commit(value: number): void {
    editing.value = false;
    const volume = Math.min(Math.max(Math.round(value), 0), MAX_VOLUME);
    draft.value = volume;
    if (Number.isFinite(volume) && props.playback?.volume !== volume) {
      emit('action', '/api/music/playback/volume', { volume });
    }
  }

  function onSlide(values: number[] | undefined): void {
    editing.value = true;
    draft.value = values?.[0] ?? draft.value;
  }
</script>

<template>
  <Card data-voice-card>
    <CardHeader>
      <CardTitle class="text-base">보이스 · 볼륨</CardTitle>
      <CardDescription>봇이 접속한 통화방과 출력 볼륨</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-5">
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm">통화방</span>
          <Badge v-if="playback?.voiceChannelName" variant="outline" class="max-w-48 truncate">
            {{ playback.voiceChannelName }}
          </Badge>
          <span v-else class="text-muted-foreground text-sm">참여 중이 아님</span>
        </div>

        <div class="flex gap-2">
          <div class="min-w-0 flex-1">
            <VoiceChannelSelect
              id="voice-channel"
              v-model="target"
              :channels="channels"
              :loading="channelsLoading"
              :disabled="busy"
              @open="loadChannels"
            />
          </div>
          <Button data-voice-join :disabled="busy || !target || target === joinedId" @click="join">
            {{ joinedId ? '이동' : '참여' }}
          </Button>
        </div>

        <p v-if="channelsError" class="text-destructive text-xs" role="alert">
          {{ channelsError }}
        </p>
        <p v-else-if="emptyWarning" class="text-muted-foreground text-xs">
          아무도 없는 통화방입니다 — 봇은 30초 뒤 스스로 나갑니다.
        </p>

        <Button
          v-if="joinedId"
          data-voice-leave
          variant="outline"
          size="sm"
          class="self-start"
          :disabled="busy"
          @click="emit('action', '/api/music/voice/leave')"
        >
          <LogOut />
          나가기
        </Button>
      </div>

      <div class="flex flex-col gap-3 border-t pt-4">
        <div class="flex items-center justify-between gap-3">
          <Label for="volume-number" class="text-muted-foreground inline-flex items-center gap-1.5">
            <Volume2 class="size-4" />
            볼륨
          </Label>
          <Input
            id="volume-number"
            data-volume-number
            type="number"
            inputmode="numeric"
            :min="0"
            :max="MAX_VOLUME"
            class="tnum h-8 w-20 text-right"
            :model-value="draft"
            :disabled="busy || !playback"
            @focus="editing = true"
            @update:model-value="(value) => (draft = Number(value))"
            @keydown.enter="commit(draft)"
            @blur="commit(draft)"
          />
        </div>
        <Slider
          data-volume-slider
          aria-label="볼륨"
          :min="0"
          :max="MAX_VOLUME"
          :step="1"
          :model-value="[draft]"
          :disabled="busy || !playback"
          @update:model-value="onSlide"
          @value-commit="(values: number[]) => commit(values[0] ?? draft)"
        />
        <div class="text-muted-foreground tnum flex justify-between text-xs" aria-hidden="true">
          <span>0</span>
          <span>100</span>
          <span>200</span>
        </div>
        <p
          class="min-h-4 text-xs"
          :class="boosted ? 'text-warning' : 'text-muted-foreground'"
          data-volume-hint
        >
          {{
            boosted
              ? '100을 넘으면 소리를 키웁니다 — 큰 소리는 깨질 수 있어요.'
              : '100이 원래 크기입니다. 통화방에 없어도 바꿀 수 있어요.'
          }}
        </p>
      </div>
    </CardContent>
  </Card>
</template>
