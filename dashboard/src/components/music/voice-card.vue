<script setup lang="ts">
  import { LogOut, Volume2 } from 'lucide-vue-next';
  import { computed, onMounted, ref, watch } from 'vue';

  import { fetchJson } from '@/api';
  import VoiceChannelSelect from '@/components/common/voice-channel-select.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Label } from '@/components/ui/label';
  import type { DiscordVoiceChannel, PlaybackState, PlaybackVolumeLevel } from '@/types';

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

  const levels: { value: PlaybackVolumeLevel; label: string }[] = [
    { value: 'low', label: '낮음' },
    { value: 'mid', label: '중간' },
    { value: 'high', label: '높음' },
  ];

  // The bot keeps its own volume, so it can be set as soon as it is in a room —
  // nothing has to be playing.
  const volumeHint = computed(() =>
    props.playback?.voiceChannelId ? '' : '통화방에 참여하면 바꿀 수 있습니다.',
  );

  function setVolume(level: PlaybackVolumeLevel): void {
    if (props.playback?.volumeLevel !== level) {
      emit('action', '/api/music/playback/volume', { level });
    }
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

      <div class="flex flex-col gap-2 border-t pt-4">
        <Label class="text-muted-foreground inline-flex items-center gap-1.5">
          <Volume2 class="size-3.5" />
          볼륨
        </Label>
        <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="볼륨">
          <Button
            v-for="level in levels"
            :key="level.value"
            :data-volume-level="level.value"
            size="sm"
            :variant="playback?.volumeLevel === level.value ? 'default' : 'outline'"
            :aria-pressed="playback?.volumeLevel === level.value"
            :disabled="busy || !playback?.voiceChannelId"
            @click="setVolume(level.value)"
          >
            {{ level.label }}
          </Button>
        </div>
        <p class="text-muted-foreground min-h-4 text-xs">{{ volumeHint }}</p>
      </div>
    </CardContent>
  </Card>
</template>
