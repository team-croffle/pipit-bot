<script setup lang="ts">
  /** The shared preview, with the event's sample values filled into the wording. */
  import { computed } from 'vue';
  import { I18nT, useI18n } from 'vue-i18n';

  import EmbedPreview from '@/components/common/embed-preview.vue';
  import { renderTemplate, sampleFor } from '@/lib/github-templates';
  import type { EmbedTemplate, GithubEventKey } from '@/types';

  const props = defineProps<{
    template: EmbedTemplate;
    variables: string[];
    eventKey: GithubEventKey;
    eventLabel: string;
  }>();

  const values = computed(() => sampleFor(props.eventKey, props.variables, props.eventLabel));
  const fill = (text: string): string => renderTemplate(text, values.value);
  const { t } = useI18n();
</script>

<template>
  <EmbedPreview :template="template" :fill="fill">
    <template #note>
      <p class="text-muted-foreground text-xs">
        <I18nT keypath="github.preview.note" scope="global">
          <template #emoji>
            <code>{{ t('github.preview.emojiName') }}</code>
          </template>
        </I18nT>
      </p>
    </template>
  </EmbedPreview>
</template>
