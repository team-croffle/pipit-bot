<script setup lang="ts">
  /**
   * What the embed will look like in Discord.
   *
   * `fill` is how a feature turns stored wording into displayed wording. The reminder
   * substitutes sample values through it; a panel is shown exactly as written and
   * leaves it out.
   */
  import { computed } from 'vue';

  import EmojiText from '@/components/common/emoji-text.vue';
  import MarkdownText from '@/components/common/markdown-text.vue';
  import type { EmbedTemplate } from '@/types';

  const props = defineProps<{
    template: EmbedTemplate;
    fill?: (text: string) => string;
  }>();

  const render = (text: string): string => (props.fill ? props.fill(text) : text);

  const content = computed(() => render(props.template.content));
  const title = computed(() => render(props.template.title));
  const description = computed(() => render(props.template.description));
  const footer = computed(() => render(props.template.footer));

  // Same rule the bot applies: a field whose value conditioned itself away takes its
  // label with it, because Discord rejects an empty half.
  const fields = computed(() =>
    props.template.fields
      .map((field) => ({
        name: render(field.name),
        value: render(field.value),
        inline: field.inline,
      }))
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
    <!-- Markdown only where Discord renders it: the plain line, the description and
         field values. Title, field names and footer are plain text in Discord — a
         markdown link in the footer prints its brackets — so they get emoji only. -->
    <template v-else>
      <div v-if="content" class="text-sm"><MarkdownText :text="content" /></div>
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
          <div v-if="description" class="text-sm"><MarkdownText :text="description" /></div>
          <div v-if="fields.length > 0" class="flex flex-wrap gap-x-6 gap-y-2">
            <div
              v-for="(field, index) in fields"
              :key="index"
              :class="field.inline ? 'min-w-24' : 'w-full'"
            >
              <p class="text-xs font-semibold"><EmojiText :text="field.name" /></p>
              <div class="text-muted-foreground text-xs"><MarkdownText :text="field.value" /></div>
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
    <slot name="note">
      <p class="text-muted-foreground text-xs">
        <code>:이름:</code> 은 발송할 때 서버 이모지로 바뀝니다. 알림 줄·내용·필드 값은 디스코드
        마크다운으로 표시되고, 제목·필드 이름·꼬리말은 디스코드가 마크다운을 렌더하지 않아 쓴 그대로
        나옵니다.
      </p>
    </slot>
  </div>
</template>
