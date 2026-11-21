<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { useI18n } from 'vue-i18n';

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
  const { t } = useI18n();
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
      <CardTitle class="text-base">{{ t('language.cardTitle') }}</CardTitle>
      <CardDescription>{{ t('language.cardDescription') }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col">
      <StateBlock :loading="!settings && !loadError" :error="settings ? '' : loadError">
        <div v-if="settings" class="grid gap-4 sm:grid-cols-2">
          <div class="flex min-w-0 flex-col gap-1.5">
            <Label for="language-dashboard">{{ t('language.dashboardDefault') }}</Label>
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
                    settings.dashboard
                      ? LANGUAGE_NAMES[settings.dashboard]
                      : t('language.eachBrowser')
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="BROWSER">{{ t('language.eachBrowser') }}</SelectItem>
                <SelectItem value="ko">{{ LANGUAGE_NAMES.ko }}</SelectItem>
                <SelectItem value="en">{{ LANGUAGE_NAMES.en }}</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-muted-foreground text-xs">{{ t('language.dashboardHint') }}</p>
          </div>
          <div class="flex min-w-0 flex-col gap-1.5">
            <Label for="language-messages">{{ t('language.messagesDefault') }}</Label>
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
            <p class="text-muted-foreground text-xs">{{ t('language.messagesHint') }}</p>
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
