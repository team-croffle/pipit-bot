<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { useI18n } from 'vue-i18n';

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
    type MessageFeature,
  } from '@/composables/use-language-settings';

  /**
   * One feature's message language: the server default (shown in brackets) or its own.
   * Saved as soon as it is picked.
   */
  const { feature, readOnly } = defineProps<{ feature: MessageFeature; readOnly: boolean }>();
  const { settings, load, save } = useLanguageSettings();
  const { t } = useI18n();
  const busy = ref(false);
  const failure = ref('');
  const DEFAULT = 'default';

  const current = computed(() => settings.value?.features[feature] ?? DEFAULT);
  const currentLabel = computed(() =>
    current.value === DEFAULT ? defaultLabel.value : LANGUAGE_NAMES[current.value as Language],
  );
  const defaultLabel = computed(() =>
    settings.value
      ? t('language.followDefaultIs', { language: LANGUAGE_NAMES[settings.value.messages] })
      : t('language.followDefault'),
  );

  async function pick(value: unknown) {
    busy.value = true;
    failure.value = await save({
      features: { [feature]: value === DEFAULT ? null : (value as Language) } as Record<
        MessageFeature,
        Language | null
      >,
    });
    busy.value = false;
  }

  onMounted(() => {
    if (!settings.value) {
      void load();
    }
  });
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1" :data-feature-language="feature">
    <div class="flex items-center gap-2">
      <span class="text-muted-foreground shrink-0 text-xs">{{
        t('language.messageLanguage')
      }}</span>
      <Select
        :model-value="current"
        :disabled="readOnly || busy || !settings"
        @update:model-value="pick"
      >
        <SelectTrigger class="h-8 min-w-36" :aria-label="t('language.ariaFeature', { feature })">
          <SelectValue>{{ currentLabel }}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="DEFAULT">{{ defaultLabel }}</SelectItem>
          <SelectItem value="ko">{{ LANGUAGE_NAMES.ko }}</SelectItem>
          <SelectItem value="en">{{ LANGUAGE_NAMES.en }}</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <p v-if="failure" class="text-destructive text-xs" role="alert">{{ failure }}</p>
  </div>
</template>
