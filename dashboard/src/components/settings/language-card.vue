<script setup lang="ts">
  import { onMounted, ref } from 'vue';

  import StateBlock from '@/components/common/state-block.vue';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Label } from '@/components/ui/label';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import {
    LANGUAGE_NAMES,
    useLanguageSettings,
    type Language,
  } from '@/composables/use-language-settings';

  /**
   * The server's defaults: the dashboard's language (a person's own choice comes first, and
   * unset means each browser's) and the language the bot's channel messages are written in.
   * Each feature may override the latter on its own page.
   */
  const { readOnly } = defineProps<{ readOnly: boolean }>();
  const { settings, loadError, load, save } = useLanguageSettings();
  const busy = ref(false);
  const failure = ref('');
  const BROWSER = 'browser';

  async function change(part: { dashboard?: Language | null; messages?: Language }) {
    busy.value = true;
    failure.value = await save(part);
    busy.value = false;
  }

  onMounted(load);
</script>

<template>
  <Card data-language-card>
    <CardHeader>
      <CardTitle class="text-base">언어</CardTitle>
      <CardDescription>
        대시보드와 봇 메시지의 기본 언어입니다. 기능마다 그 페이지에서 메시지 언어를 따로 고를 수
        있고, 혼자만 보는 응답은 각자의 디스코드 언어를 따릅니다.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col">
      <StateBlock :loading="!settings && !loadError" :error="settings ? '' : loadError">
        <div v-if="settings" class="grid gap-4 sm:grid-cols-2">
          <div class="flex min-w-0 flex-col gap-1.5">
            <Label for="language-dashboard">대시보드 기본 언어</Label>
            <Select
              :model-value="settings.dashboard ?? BROWSER"
              :disabled="readOnly || busy"
              @update:model-value="
                (value) => change({ dashboard: value === BROWSER ? null : (value as Language) })
              "
            >
              <SelectTrigger id="language-dashboard" class="w-full" data-language-dashboard>
                <SelectValue>
                  {{
                    settings.dashboard ? LANGUAGE_NAMES[settings.dashboard] : '각자의 브라우저 언어'
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="BROWSER">각자의 브라우저 언어</SelectItem>
                <SelectItem value="ko">{{ LANGUAGE_NAMES.ko }}</SelectItem>
                <SelectItem value="en">{{ LANGUAGE_NAMES.en }}</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-muted-foreground text-xs">
              개인이 고른 언어가 있으면 그것이 먼저입니다.
            </p>
          </div>
          <div class="flex min-w-0 flex-col gap-1.5">
            <Label for="language-messages">봇 메시지 기본 언어</Label>
            <Select
              :model-value="settings.messages"
              :disabled="readOnly || busy"
              @update:model-value="(value) => change({ messages: value as Language })"
            >
              <SelectTrigger id="language-messages" class="w-full" data-language-messages>
                <SelectValue>{{ LANGUAGE_NAMES[settings.messages] }}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ko">{{ LANGUAGE_NAMES.ko }}</SelectItem>
                <SelectItem value="en">{{ LANGUAGE_NAMES.en }}</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-muted-foreground text-xs">
              음악 배너, GitHub 알림, 입장·퇴장 기록, 결산처럼 채널에 올라가는 메시지입니다.
            </p>
          </div>
        </div>
      </StateBlock>
      <p v-if="failure" class="text-destructive mt-3 text-xs" role="alert">{{ failure }}</p>
      <p v-else-if="settings && loadError" class="text-destructive mt-3 text-xs" role="alert">
        {{ loadError }}
      </p>
    </CardContent>
  </Card>
</template>
