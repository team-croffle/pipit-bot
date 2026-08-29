<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';

  import { fetchJson, putJson } from '@/api';
  import StateBlock from '@/components/common/state-block.vue';
  import { Button } from '@/components/ui/button';
  import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Label } from '@/components/ui/label';
  import type { BotRuntimeConfig, DiscordChannel } from '@/types';

  const { readOnly } = defineProps<{ readOnly: boolean }>();

  const channelIds = ref<string[]>([]);
  const channels = ref<DiscordChannel[]>([]);
  const loading = ref(true);
  const error = ref('');
  const saved = ref('');

  const UNCATEGORIZED = '카테고리 없음';

  const groups = computed(() => {
    const result: { category: string; channels: DiscordChannel[] }[] = [];
    for (const channel of channels.value) {
      const category = channel.category ?? UNCATEGORIZED;
      const last = result.at(-1);
      if (last?.category === category) {
        last.channels.push(channel);
        continue;
      }

      result.push({ category, channels: [channel] });
    }

    return result;
  });

  onMounted(async () => {
    try {
      const [config, channelBody] = await Promise.all([
        fetchJson<BotRuntimeConfig>('/api/config'),
        fetchJson<{ channels: DiscordChannel[] }>('/api/discord/channels'),
      ]);
      channelIds.value = config.musicChannelIds ?? [];
      channels.value = channelBody.channels;
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '채널 설정을 불러오지 못했습니다.';
    } finally {
      loading.value = false;
    }
  });

  function toggle(channelId: string, on: boolean): void {
    channelIds.value = on
      ? [...new Set([...channelIds.value, channelId])]
      : channelIds.value.filter((id) => id !== channelId);
  }

  async function save(): Promise<void> {
    error.value = '';
    saved.value = '';
    try {
      // PUT /api/config is a patch — the command prefix (edited on the settings
      // page) is left alone by sending only this field.
      const config = await putJson<BotRuntimeConfig>('/api/config', {
        musicChannelIds: channelIds.value,
      });
      channelIds.value = config.musicChannelIds ?? [];
      saved.value = '저장했습니다.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '저장하지 못했습니다.';
    }
  }
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">명령 채널 제한</CardTitle>
      <CardDescription>
        음악 명령을 선택한 텍스트 채널로 제한합니다. 모두 해제하면 어느 채널에서나 허용됩니다.
      </CardDescription>
      <CardAction>
        <Button variant="outline" size="sm" :disabled="readOnly || loading" @click="save">
          저장
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <StateBlock :loading="loading" :error="error">
        <p v-if="saved" class="text-muted-foreground text-sm">{{ saved }}</p>
        <div v-for="group in groups" :key="group.category" class="flex flex-col gap-2">
          <span class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {{ group.category }}
          </span>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="channel in group.channels"
              :key="channel.id"
              class="flex items-center gap-2.5"
              :title="channel.canPost ? '' : '봇이 이 채널에 글을 쓸 수 없습니다.'"
            >
              <Checkbox
                :id="`music-${channel.id}`"
                :model-value="channelIds.includes(channel.id)"
                :disabled="readOnly || !channel.canPost"
                @update:model-value="toggle(channel.id, $event === true)"
              />
              <Label
                :for="`music-${channel.id}`"
                class="truncate font-normal"
                :class="channel.canPost ? '' : 'text-muted-foreground'"
              >
                #{{ channel.name }}
              </Label>
            </div>
          </div>
        </div>
      </StateBlock>
    </CardContent>
  </Card>
</template>
