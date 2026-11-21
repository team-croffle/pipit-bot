<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { I18nT, useI18n } from 'vue-i18n';

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
  import { actorLabel, cloneTemplate, variableHint } from '@/lib/github-templates';
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

  const { t } = useI18n();

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

  const actorHint = computed(() => actorLabel(props.eventKey));
  // The branch syntax is data (`{name|…|…}`); only the two branch names are copy.
  const branchExample = computed(
    () => `{name|${t('github.editor.whenSet')}|${t('github.editor.whenUnset')}}`,
  );

  function hintFor(name: string): string {
    return name === 'actor' ? `${variableHint('actor')} — ${actorHint.value}` : variableHint(name);
  }
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogScrollContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ t('github.editor.title', { event: eventLabel }) }}</DialogTitle>
        <DialogDescription>
          {{ t('github.editor.description') }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-5">
        <EmbedForm
          :draft="draft"
          :read-only="readOnly"
          :id-prefix="`tpl-${eventKey}`"
          :title-hint="t('github.editor.titleHint')"
          content-placeholder="{mentions}"
        >
          <template #chips="{ insert }">
            <div class="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
              <p class="text-muted-foreground text-xs">{{ t('github.editor.chips') }}</p>
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
                <I18nT keypath="github.editor.actorHint" scope="global">
                  <template #actorVar>
                    <code>{{ '{actor}' }}</code>
                  </template>
                  <template #actor>
                    <strong>{{ actorHint }}</strong>
                  </template>
                  <template #branch>
                    <code>{{ branchExample }}</code>
                  </template>
                  <template #value>
                    <code>{}</code>
                  </template>
                </I18nT>
              </p>
            </div>
          </template>
        </EmbedForm>

        <div class="flex flex-col gap-2">
          <p class="text-sm font-medium">{{ t('github.editor.preview') }}</p>
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
          {{ t('github.editor.reset') }}
        </Button>
        <div class="flex gap-2">
          <Button variant="outline" @click="emit('update:open', false)">{{
            t('github.editor.cancel')
          }}</Button>
          <Button :disabled="readOnly" @click="emit('save', draft)">{{
            t('github.editor.apply')
          }}</Button>
        </div>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
