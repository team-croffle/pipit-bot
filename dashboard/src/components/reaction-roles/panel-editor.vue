<script setup lang="ts">
  /**
   * The message a panel publishes.
   *
   * The same form the reminder uses, without the variable chips — a panel is sent
   * exactly as it is written, so there is nothing to substitute and the preview is
   * the message.
   */
  import { ref, watch } from 'vue';

  import EmbedForm from '@/components/common/embed-form.vue';
  import EmbedPreview from '@/components/common/embed-preview.vue';
  import { Button } from '@/components/ui/button';
  import {
    Dialog,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogScrollContent,
    DialogTitle,
  } from '@/components/ui/dialog';
  import type { EmbedTemplate, ReactionRolePanel } from '@/types';

  const props = defineProps<{
    open: boolean;
    panel: ReactionRolePanel;
    readOnly: boolean;
  }>();

  const emit = defineEmits<{
    'update:open': [open: boolean];
    save: [embed: EmbedTemplate];
  }>();

  function clone(embed: EmbedTemplate): EmbedTemplate {
    return { ...embed, fields: embed.fields.map((field) => ({ ...field })) };
  }

  const draft = ref<EmbedTemplate>(clone(props.panel.embed));

  // Reopening starts from what is stored, so a cancelled edit leaves nothing behind.
  watch(
    () => props.open,
    (open) => {
      if (open) {
        draft.value = clone(props.panel.embed);
      }
    },
    { immediate: true },
  );
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogScrollContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ panel.name || '패널' }} 메시지</DialogTitle>
        <DialogDescription>
          봇이 채널에 올릴 메시지입니다. 여기에 쓴 그대로 발행됩니다.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-5">
        <EmbedForm :draft="draft" :read-only="readOnly" :id-prefix="`panel-${panel.id}`">
          <template #content-hint>
            <p class="text-muted-foreground text-xs">
              임베드 위에 붙는 평문 줄입니다. 패널은 아무도 멘션하지 않습니다.
            </p>
          </template>
        </EmbedForm>

        <div class="flex flex-col gap-2">
          <p class="text-sm font-medium">미리보기</p>
          <EmbedPreview :template="draft" />
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" @click="emit('update:open', false)">취소</Button>
        <Button :disabled="readOnly" @click="emit('save', draft)">적용</Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
