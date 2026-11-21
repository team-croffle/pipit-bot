<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { useI18n } from 'vue-i18n';

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

  const { t } = useI18n();
  const { readOnly } = defineProps<{ readOnly: boolean }>();

  const channelIds = ref<string[]>([]);
  const channels = ref<DiscordChannel[]>([]);
  const loading = ref(true);
  const error = ref('');
  const saved = ref('');

  const groups = computed(() => {
    const result: { category: string; channels: DiscordChannel[] }[] = [];
    for (const channel of channels.value) {
      const category = channel.category ?? t('music.channels.uncategorized');
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
      error.value = cause instanceof Error ? cause.message : t('music.channels.loadFailed');
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
      // PUT /api/config is a patch; this card owns its only field.
      const config = await putJson<BotRuntimeConfig>('/api/config', {
        musicChannelIds: channelIds.value,
      });
      channelIds.value = config.musicChannelIds ?? [];
      saved.value = t('music.channels.saved');
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : t('music.channels.saveFailed');
    }
  }
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">{{ t('music.channels.title') }}</CardTitle>
      <CardDescription>
        {{ t('music.channels.description') }}
      </CardDescription>
      <CardAction>
        <Button variant="outline" size="sm" :disabled="readOnly || loading" @click="save">
          {{ t('music.channels.save') }}
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
              :title="channel.canPost ? '' : t('music.channels.cannotPost')"
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
