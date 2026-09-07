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

  import EmojiPicker from '@/components/common/emoji-picker.vue';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Separator } from '@/components/ui/separator';
  import { Switch } from '@/components/ui/switch';
  import { Textarea } from '@/components/ui/textarea';
  import type { EmbedTemplate } from '@/types';

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
      <Label :for="`${idPrefix}-content`">알림 줄 (임베드 위 평문)</Label>
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
          디스코드는 임베드 안의 멘션으로 알림을 울리지 않습니다. 실제로 사람을 부르려면 멘션은 이
          줄에 있어야 합니다.
        </p>
      </slot>
      <p class="text-muted-foreground text-xs">
        서버 이모지는 <code>:이름:</code> 으로 들어가고, 발송할 때 실제 이모지로 바뀝니다.
      </p>
    </div>

    <Separator />

    <div class="grid gap-4 sm:grid-cols-[1fr_auto]">
      <div class="flex flex-col gap-1.5">
        <Label :for="`${idPrefix}-title`">제목</Label>
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
        <Label :for="`${idPrefix}-color`">색</Label>
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
            지우기
          </Button>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <Label :for="`${idPrefix}-desc`">내용</Label>
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
        <Label>필드</Label>
        <Button
          variant="outline"
          size="sm"
          :disabled="readOnly || draft.fields.length >= MAX_FIELDS"
          @click="addField"
        >
          <Plus />
          필드 추가
        </Button>
      </div>
      <p v-if="draft.fields.length === 0" class="text-muted-foreground text-sm">
        필드가 없습니다. 인라인으로 두면 여러 개가 한 줄에 나란히 놓입니다.
      </p>
      <div
        v-for="(field, index) in draft.fields"
        :key="`field-${index}`"
        class="bg-muted/40 grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto_auto]"
      >
        <Input
          v-model="field.name"
          class="font-gothic"
          placeholder="이름"
          :disabled="readOnly"
          :aria-label="`필드 ${index + 1} 이름`"
          @focus="onFocus"
        />
        <Input
          v-model="field.value"
          class="font-gothic"
          placeholder="값"
          :disabled="readOnly"
          :aria-label="`필드 ${index + 1} 값`"
          @focus="onFocus"
        />
        <label class="flex items-center gap-2 text-sm">
          <Checkbox v-model="field.inline" :disabled="readOnly" />
          인라인
        </label>
        <Button
          variant="ghost"
          size="icon"
          :disabled="readOnly"
          :aria-label="`필드 ${index + 1} 삭제`"
          @click="removeField(index)"
        >
          <Trash2 />
        </Button>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div class="flex flex-col gap-1.5">
        <Label :for="`${idPrefix}-footer`">꼬리말</Label>
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
        <Label :for="`${idPrefix}-time`" class="font-normal">시간 표시</Label>
        <Switch :id="`${idPrefix}-time`" v-model="draft.showTimestamp" :disabled="readOnly" />
      </div>
    </div>
  </div>
</template>
