<script setup lang="ts">
  /**
   * The controls for composing one embed: the plain line above it, title, colour,
   * description, fields, footer and timestamp.
   *
   * WHY the draft is mutated in place rather than emitted: every input is bound with
   * `v-model`, and routing each keystroke through an event would rebuild the object
   * on every character. The parent owns the draft and reads it when it is ready to
   * save. Pass a copy if the edit has to be cancellable.
   *
   * The `chips` slot is for whatever a feature wants to offer above the fields, such
   * as the reminder's template variables. Anything inserted through it lands at the
   * caret, the same as an emoji.
   */
  import { Plus, Trash2 } from 'lucide-vue-next';
  import { ref } from 'vue';
  import { I18nT, useI18n } from 'vue-i18n';

  import EmojiPicker from '@/components/common/emoji-picker.vue';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Separator } from '@/components/ui/separator';
  import { Switch } from '@/components/ui/switch';
  import { Textarea } from '@/components/ui/textarea';
  import type { EmbedTemplate } from '@/types';

  const { t } = useI18n();

  const props = defineProps<{
    draft: EmbedTemplate;
    readOnly: boolean;
    /** Keeps the label/input pairs unique when more than one form is on a page. */
    idPrefix: string;
    /** Shown under the title field, where a feature has something to say about it. */
    titleHint?: string;
    contentPlaceholder?: string;
  }>();

  const MAX_FIELDS = 10;

  /**
   * The last input the operator touched, so a variable chip or an emoji lands where
   * they were typing instead of always at the end of the description.
   */
  const focused = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);

  function onFocus(event: FocusEvent): void {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      focused.value = target;
    }
  }

  function insert(text: string): void {
    const target = focused.value;
    if (props.readOnly || !target) {
      return;
    }

    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    target.setRangeText(text, start, end, 'end');
    // setRangeText writes straight to the DOM, so v-model needs telling.
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.focus();
  }

  function addField(): void {
    if (props.draft.fields.length >= MAX_FIELDS) {
      return;
    }

    props.draft.fields = [...props.draft.fields, { name: '', value: '', inline: true }];
  }

  function removeField(index: number): void {
    props.draft.fields = props.draft.fields.filter((_, item) => item !== index);
  }

  defineExpose({ insert });
</script>

<template>
  <div class="flex flex-col gap-5">
    <slot name="chips" :insert="insert" />

    <div class="flex flex-col gap-1.5">
      <Label :for="`${idPrefix}-content`">{{ t('embed.content') }}</Label>
      <div class="flex gap-2">
        <Input
          :id="`${idPrefix}-content`"
          v-model="draft.content"
          class="font-gothic"
          :placeholder="contentPlaceholder"
          :disabled="readOnly"
          @focus="onFocus"
        />
        <EmojiPicker :disabled="readOnly" @pick="insert" />
      </div>
      <slot name="content-hint">
        <p class="text-muted-foreground text-xs">
          {{ t('embed.contentHint') }}
        </p>
      </slot>
      <p class="text-muted-foreground text-xs">
        <I18nT keypath="embed.emojiHint" scope="global">
          <template #code>
            <code>{{ t('embed.emojiName') }}</code>
          </template>
        </I18nT>
      </p>
    </div>

    <Separator />

    <div class="grid gap-4 sm:grid-cols-[1fr_auto]">
      <div class="flex flex-col gap-1.5">
        <Label :for="`${idPrefix}-title`">{{ t('embed.title') }}</Label>
        <div class="flex gap-2">
          <Input
            :id="`${idPrefix}-title`"
            v-model="draft.title"
            class="font-gothic"
            :disabled="readOnly"
            @focus="onFocus"
          />
          <EmojiPicker :disabled="readOnly" @pick="insert" />
        </div>
        <p v-if="titleHint" class="text-muted-foreground text-xs">{{ titleHint }}</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label :for="`${idPrefix}-color`">{{ t('embed.color') }}</Label>
        <div class="flex items-center gap-2">
          <input
            :id="`${idPrefix}-color`"
            type="color"
            :value="draft.color || '#5865f2'"
            class="border-input h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
            :disabled="readOnly"
            @input="draft.color = ($event.target as HTMLInputElement).value"
          />
          <Button
            variant="ghost"
            size="sm"
            :disabled="readOnly || !draft.color"
            @click="draft.color = ''"
          >
            {{ t('embed.clear') }}
          </Button>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <Label :for="`${idPrefix}-desc`">{{ t('embed.description') }}</Label>
      <div class="flex gap-2">
        <Textarea
          :id="`${idPrefix}-desc`"
          v-model="draft.description"
          rows="3"
          class="font-gothic"
          :disabled="readOnly"
          @focus="onFocus"
        />
        <EmojiPicker :disabled="readOnly" @pick="insert" />
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-3">
        <Label>{{ t('embed.fields') }}</Label>
        <Button
          variant="outline"
          size="sm"
          :disabled="readOnly || draft.fields.length >= MAX_FIELDS"
          @click="addField"
        >
          <Plus />
          {{ t('embed.addField') }}
        </Button>
      </div>
      <p v-if="draft.fields.length === 0" class="text-muted-foreground text-sm">
        {{ t('embed.noFields') }}
      </p>
      <div
        v-for="(field, index) in draft.fields"
        :key="`field-${index}`"
        class="bg-muted/40 grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto_auto]"
      >
        <Input
          v-model="field.name"
          class="font-gothic"
          :placeholder="t('embed.fieldName')"
          :disabled="readOnly"
          :aria-label="t('embed.fieldNameN', { n: index + 1 })"
          @focus="onFocus"
        />
        <Input
          v-model="field.value"
          class="font-gothic"
          :placeholder="t('embed.fieldValue')"
          :disabled="readOnly"
          :aria-label="t('embed.fieldValueN', { n: index + 1 })"
          @focus="onFocus"
        />
        <label class="flex items-center gap-2 text-sm">
          <Checkbox v-model="field.inline" :disabled="readOnly" />
          {{ t('embed.inline') }}
        </label>
        <Button
          variant="ghost"
          size="icon"
          :disabled="readOnly"
          :aria-label="t('embed.deleteFieldN', { n: index + 1 })"
          @click="removeField(index)"
        >
          <Trash2 />
        </Button>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div class="flex flex-col gap-1.5">
        <Label :for="`${idPrefix}-footer`">{{ t('embed.footer') }}</Label>
        <div class="flex gap-2">
          <Input
            :id="`${idPrefix}-footer`"
            v-model="draft.footer"
            class="font-gothic"
            :disabled="readOnly"
            @focus="onFocus"
          />
          <EmojiPicker :disabled="readOnly" @pick="insert" />
        </div>
      </div>
      <div class="flex items-center gap-3 pb-1">
        <Label :for="`${idPrefix}-time`" class="font-normal">{{ t('embed.timestamp') }}</Label>
        <Switch :id="`${idPrefix}-time`" v-model="draft.showTimestamp" :disabled="readOnly" />
      </div>
    </div>
  </div>
</template>
