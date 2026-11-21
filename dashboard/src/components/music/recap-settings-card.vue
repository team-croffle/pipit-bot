<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { I18nT, useI18n } from 'vue-i18n';

  import { fetchJson, putJson } from '@/api';
  import ChannelSelect from '@/components/common/channel-select.vue';
  import FeatureLanguageSelect from '@/components/common/feature-language-select.vue';
  import OptionSelect from '@/components/common/option-select.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Switch } from '@/components/ui/switch';
  import type { DiscordChannel } from '@/types';

  /**
   * The music recap settings (`data/music-recap.json`): keeping the play history, posting
   * each month's and year's recap, the channel, the time zone periods follow, the list length.
   */
  interface RecapSettings {
    record: boolean;
    post: boolean;
    channelId: string | null;
    timeZone: string;
    topN: number;
    language: 'en' | 'ko';
  }

  interface Answer {
    settings: RecapSettings;
    loadError: string | null;
  }

  const { t } = useI18n();
  const { readOnly } = defineProps<{ readOnly: boolean }>();

  const ZONES = [
    'Asia/Seoul',
    'Asia/Tokyo',
    'UTC',
    'Europe/London',
    'Europe/Berlin',
    'America/New_York',
    'America/Los_Angeles',
  ];

  const saved = ref<Answer | null>(null);
  const draft = ref<RecapSettings | null>(null);
  const channels = ref<DiscordChannel[]>([]);
  const error = ref('');
  const busy = ref(false);
  const notice = ref('');

  const zoneOptions = computed(() => {
    const zones = new Set(ZONES);
    if (draft.value) {
      zones.add(draft.value.timeZone);
    }
    return [...zones].map((zone) => ({ id: zone, name: zone }));
  });
  const changed = computed(
    () =>
      saved.value !== null &&
      draft.value !== null &&
      JSON.stringify(saved.value.settings) !== JSON.stringify(draft.value),
  );
  const needsChannel = computed(() => draft.value?.post === true && !draft.value.channelId);

  async function load(): Promise<void> {
    try {
      const [answer, channelBody] = await Promise.all([
        fetchJson<Answer>('/api/settings/music-recap'),
        fetchJson<{ channels: DiscordChannel[] }>('/api/discord/channels').catch(() => ({
          channels: [],
        })),
      ]);
      saved.value = answer;
      draft.value = { ...answer.settings };
      channels.value = channelBody.channels;
      error.value = '';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : t('recap.settings.loadFailed');
    }
  }

  async function save(): Promise<void> {
    if (!draft.value) {
      return;
    }
    busy.value = true;
    notice.value = '';
    try {
      saved.value = await putJson<Answer>('/api/settings/music-recap', draft.value);
      draft.value = { ...saved.value.settings };
      error.value = '';
      notice.value = t('recap.settings.saved');
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : t('recap.settings.saveFailed');
    } finally {
      busy.value = false;
    }
  }

  onMounted(load);
</script>

<template>
  <Card data-recap-settings>
    <CardHeader>
      <CardTitle class="text-base">{{ t('recap.title') }}</CardTitle>
      <CardDescription>
        {{ t('recap.settings.description') }}
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col">
      <StateBlock :loading="!draft && !error" :error="draft ? '' : error">
        <div v-if="draft" class="flex flex-col">
          <div class="flex items-center justify-between gap-4 border-b pb-3">
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ t('recap.settings.record') }}</p>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ t('recap.settings.recordHint') }}
              </p>
            </div>
            <Switch
              v-model="draft.record"
              data-recap-record
              :aria-label="t('recap.settings.record')"
              :disabled="readOnly || busy"
            />
          </div>
          <div class="flex items-center justify-between gap-4 border-b py-3">
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ t('recap.settings.post') }}</p>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ t('recap.settings.postHint') }}
              </p>
            </div>
            <Switch
              v-model="draft.post"
              data-recap-post
              :aria-label="t('recap.settings.post')"
              :disabled="readOnly || busy"
            />
          </div>
          <div class="grid gap-4 pt-3 sm:grid-cols-2">
            <div class="flex min-w-0 flex-col gap-1.5">
              <Label for="recap-channel">{{ t('recap.settings.channel') }}</Label>
              <ChannelSelect
                id="recap-channel"
                v-model="draft.channelId"
                :channels="channels"
                :placeholder="t('recap.settings.chooseChannel')"
                :empty-value="null"
                :disabled="readOnly || busy"
              />
            </div>
            <div class="flex min-w-0 flex-col gap-1.5">
              <Label for="recap-zone">{{ t('recap.settings.timeZone') }}</Label>
              <OptionSelect
                id="recap-zone"
                v-model="draft.timeZone"
                :options="zoneOptions"
                :placeholder="t('recap.settings.timeZone')"
                :disabled="readOnly || busy"
              />
            </div>
            <div class="flex min-w-0 flex-col gap-1.5">
              <Label for="recap-top">{{ t('recap.settings.topN') }}</Label>
              <Input
                id="recap-top"
                v-model.number="draft.topN"
                type="number"
                min="3"
                max="25"
                :disabled="readOnly || busy"
              />
            </div>
            <div class="flex min-w-0 flex-col gap-1.5">
              <Label>{{ t('recap.settings.language') }}</Label>
              <!-- Since v0.8.3 the recap's language is a language setting (features.recap). -->
              <FeatureLanguageSelect feature="recap" :read-only="readOnly" />
              <p class="text-muted-foreground text-xs">
                <I18nT keypath="recap.settings.languageHint" scope="global">
                  <template #command><code>/recap</code></template>
                </I18nT>
              </p>
            </div>
          </div>
          <p v-if="needsChannel" class="text-warning mt-3 text-xs" data-recap-needs-channel>
            {{ t('recap.settings.needsChannel') }}
          </p>
          <div class="mt-4 flex items-center gap-3">
            <Button
              size="sm"
              data-recap-save
              :disabled="readOnly || busy || !changed || needsChannel"
              @click="save"
            >
              {{ t('recap.settings.save') }}
            </Button>
            <span v-if="notice && !changed" class="text-muted-foreground text-xs">{{
              notice
            }}</span>
          </div>
        </div>
      </StateBlock>
      <p v-if="saved?.loadError" class="text-destructive mt-3 text-xs" role="alert">
        {{ saved.loadError }}
      </p>
      <p
        v-else-if="draft && error"
        class="text-destructive mt-3 text-xs"
        role="alert"
        data-recap-settings-error
      >
        {{ error }}
      </p>
    </CardContent>
  </Card>
</template>
