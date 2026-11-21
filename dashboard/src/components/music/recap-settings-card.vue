<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';

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
      error.value = cause instanceof Error ? cause.message : '결산 설정을 불러오지 못했습니다.';
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
      notice.value = '저장했습니다.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '결산 설정을 저장하지 못했습니다.';
    } finally {
      busy.value = false;
    }
  }

  onMounted(load);
</script>

<template>
  <Card data-recap-settings>
    <CardHeader>
      <CardTitle class="text-base">음악 결산</CardTitle>
      <CardDescription>
        재생 기록으로 월말·연말 결산을 만듭니다. 누가 어떤 곡을 신청했는지는 어디에도 보이지
        않습니다.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col">
      <StateBlock :loading="!draft && !error" :error="draft ? '' : error">
        <div v-if="draft" class="flex flex-col">
          <div class="flex items-center justify-between gap-4 border-b pb-3">
            <div class="min-w-0">
              <p class="text-sm font-medium">재생 기록</p>
              <p class="text-muted-foreground mt-0.5 text-xs">
                끄면 그동안의 재생은 결산에 들어가지 않습니다. 기록은 400일 뒤 정리됩니다.
              </p>
            </div>
            <Switch
              v-model="draft.record"
              data-recap-record
              aria-label="재생 기록"
              :disabled="readOnly || busy"
            />
          </div>
          <div class="flex items-center justify-between gap-4 border-b py-3">
            <div class="min-w-0">
              <p class="text-sm font-medium">디스코드에 게시</p>
              <p class="text-muted-foreground mt-0.5 text-xs">
                매월 1일에 지난달, 1월 1일에 지난해 결산을 아래 채널에 올립니다.
              </p>
            </div>
            <Switch
              v-model="draft.post"
              data-recap-post
              aria-label="디스코드에 게시"
              :disabled="readOnly || busy"
            />
          </div>
          <div class="grid gap-4 pt-3 sm:grid-cols-2">
            <div class="flex min-w-0 flex-col gap-1.5">
              <Label for="recap-channel">게시 채널</Label>
              <ChannelSelect
                id="recap-channel"
                v-model="draft.channelId"
                :channels="channels"
                placeholder="채널 선택"
                :empty-value="null"
                :disabled="readOnly || busy"
              />
            </div>
            <div class="flex min-w-0 flex-col gap-1.5">
              <Label for="recap-zone">시간대</Label>
              <OptionSelect
                id="recap-zone"
                v-model="draft.timeZone"
                :options="zoneOptions"
                placeholder="시간대"
                :disabled="readOnly || busy"
              />
            </div>
            <div class="flex min-w-0 flex-col gap-1.5">
              <Label for="recap-top">곡 순위 개수</Label>
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
              <Label>결산 언어</Label>
              <!-- Since v0.8.3 the recap's language is a language setting (features.recap). -->
              <FeatureLanguageSelect feature="recap" :read-only="readOnly" />
              <p class="text-muted-foreground text-xs">
                채널에 올리는 결산의 언어로, 바로 저장됩니다. <code>/recap</code>은 각자의 디스코드
                언어를 따릅니다.
              </p>
            </div>
          </div>
          <p v-if="needsChannel" class="text-warning mt-3 text-xs" data-recap-needs-channel>
            게시하려면 채널을 골라 주세요.
          </p>
          <div class="mt-4 flex items-center gap-3">
            <Button
              size="sm"
              data-recap-save
              :disabled="readOnly || busy || !changed || needsChannel"
              @click="save"
            >
              저장
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
