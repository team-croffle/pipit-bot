<script setup lang="ts">
  /** The shared preview, with the event's sample values filled into the wording. */
  import { computed } from 'vue';

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
</script>

<template>
  <EmbedPreview :template="template" :fill="fill">
    <template #note>
      <p class="text-muted-foreground text-xs">
        변수는 예시 값으로 채워 보여줍니다. 실제 값은 이벤트가 도착할 때 정해집니다.
        <code>:이름:</code> 은 발송할 때 서버 이모지로 바뀝니다.
      </p>
    </template>
  </EmbedPreview>
</template>
