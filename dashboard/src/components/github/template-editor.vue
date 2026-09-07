<script setup lang="ts">
  import { computed, ref, watch } from 'vue';

  import EmbedForm from '@/components/common/embed-form.vue';
  import EmbedPreview from '@/components/github/embed-preview.vue';
  import { Button } from '@/components/ui/button';
  import {
    Dialog,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogScrollContent,
    DialogTitle,
  } from '@/components/ui/dialog';
  import { actorLabels, cloneTemplate, variableHints } from '@/lib/github-templates';
  import type { EmbedTemplate, GithubEventKey } from '@/types';

  const props = defineProps<{
    open: boolean;
    eventKey: GithubEventKey;
    eventLabel: string;
    template: EmbedTemplate;
    variables: string[];
    readOnly: boolean;
    /** True while the event still follows the built-in default. */
    inherited: boolean;
    /** What `{event}` renders as for this event. */
    sampleLabel: string;
  }>();

  const emit = defineEmits<{
    'update:open': [open: boolean];
    save: [template: EmbedTemplate];
    reset: [];
  }>();

  const draft = ref<EmbedTemplate>(cloneTemplate(props.template));

  // Reopening on another event has to start from that event's wording, not from
  // whatever was left in the box last time.
  watch(
    () => [props.open, props.eventKey] as const,
    ([open]) => {
      if (open) {
        draft.value = cloneTemplate(props.template);
      }
    },
    { immediate: true },
  );

  const actorHint = computed(() => actorLabels[props.eventKey]);

  function hintFor(name: string): string {
    return name === 'actor'
      ? `${variableHints.actor} — ${actorHint.value}`
      : (variableHints[name] ?? '');
  }
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogScrollContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ eventLabel }} 문구</DialogTitle>
        <DialogDescription>
          이 이벤트가 도착했을 때 보낼 메시지입니다. 아래 변수만 쓸 수 있습니다.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-5">
        <EmbedForm
          :draft="draft"
          :read-only="readOnly"
          :id-prefix="`tpl-${eventKey}`"
          title-hint="제목에는 PR·Issue 링크가 자동으로 걸립니다."
          content-placeholder="{mentions}"
        >
          <template #chips="{ insert }">
            <div class="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
              <p class="text-muted-foreground text-xs">사용 가능한 변수 — 눌러서 넣기</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="name in variables"
                  :key="name"
                  type="button"
                  class="bg-background hover:bg-accent font-gothic rounded-md border px-2 py-1 text-xs"
                  :title="hintFor(name)"
                  :disabled="readOnly"
                  @click="insert(`{${name}}`)"
                >
                  {{ '{' + name + '}' }}
                </button>
              </div>
              <p class="text-muted-foreground text-xs">
                <code>{{ '{actor}' }}</code> 는 이 이벤트에서
                <strong>{{ actorHint }}</strong> 입니다. <code>{name|있을 때|없을 때}</code> 로 값
                유무에 따라 문구를 바꾸고, 분기 안의 <code>{}</code> 자리에 값이 들어갑니다.
              </p>
            </div>
          </template>
        </EmbedForm>

        <div class="flex flex-col gap-2">
          <p class="text-sm font-medium">미리보기</p>
          <EmbedPreview
            :template="draft"
            :variables="variables"
            :event-key="eventKey"
            :event-label="sampleLabel"
          />
        </div>
      </div>

      <DialogFooter class="gap-2 sm:justify-between">
        <Button
          variant="ghost"
          class="text-destructive hover:text-destructive"
          :disabled="readOnly || inherited"
          @click="emit('reset')"
        >
          기본값으로 되돌리기
        </Button>
        <div class="flex gap-2">
          <Button variant="outline" @click="emit('update:open', false)">취소</Button>
          <Button :disabled="readOnly" @click="emit('save', draft)">적용</Button>
        </div>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
