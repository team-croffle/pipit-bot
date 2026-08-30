<script setup lang="ts">
  import { computed } from 'vue';

  import EmojiText from '@/components/common/emoji-text.vue';
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

  const content = computed(() => fill(props.template.content));
  const title = computed(() => fill(props.template.title));
  const description = computed(() => fill(props.template.description));
  const footer = computed(() => fill(props.template.footer));

  // Same rule the bot applies: a field whose value conditioned itself away takes its
  // label with it, because Discord rejects an empty half.
  const fields = computed(() =>
    props.template.fields
      .map((field) => ({ name: fill(field.name), value: fill(field.value), inline: field.inline }))
      .filter((field) => field.name && field.value),
  );

  const empty = computed(
    () =>
      !content.value &&
      !title.value &&
      !description.value &&
      !footer.value &&
      fields.value.length === 0,
  );

  const stamp = new Date().toLocaleString();
</script>

<template>
  <div class="flex flex-col gap-2">
    <p v-if="empty" class="text-muted-foreground text-sm">
      아직 보낼 내용이 없습니다 — 문구를 채우면 여기에 미리보기가 나타납니다.
    </p>
    <template v-else>
      <p v-if="content" class="text-sm"><EmojiText :text="content" /></p>
      <div
        v-if="title || description || fields.length > 0 || footer"
        class="bg-muted/40 flex gap-3 rounded-md border py-2.5 pr-3 pl-0"
      >
        <span
          class="w-1 shrink-0 self-stretch rounded-full"
          :style="{ backgroundColor: template.color || 'var(--color-border)' }"
          aria-hidden="true"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <p v-if="title" class="text-primary text-sm font-semibold">
            <EmojiText :text="title" />
          </p>
          <p v-if="description" class="text-sm"><EmojiText :text="description" /></p>
          <div v-if="fields.length > 0" class="flex flex-wrap gap-x-6 gap-y-2">
            <div
              v-for="(field, index) in fields"
              :key="index"
              :class="field.inline ? 'min-w-24' : 'w-full'"
            >
              <p class="text-xs font-semibold"><EmojiText :text="field.name" /></p>
              <p class="text-muted-foreground text-xs"><EmojiText :text="field.value" /></p>
            </div>
          </div>
          <p v-if="footer || template.showTimestamp" class="text-muted-foreground text-xs">
            <EmojiText v-if="footer" :text="footer" />
            <template v-if="footer && template.showTimestamp"> · </template>
            <template v-if="template.showTimestamp">{{ stamp }}</template>
          </p>
        </div>
      </div>
    </template>
    <p class="text-muted-foreground text-xs">
      변수는 예시 값으로 채워 보여줍니다. 실제 값은 이벤트가 도착할 때 정해집니다.
      <code>:이름:</code> 은 발송할 때 서버 이모지로 바뀝니다.
    </p>
  </div>
</template>
