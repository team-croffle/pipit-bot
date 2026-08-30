<script setup lang="ts">
  import { Plus, Trash2 } from 'lucide-vue-next';
  import { computed, ref, watch } from 'vue';

  import EmojiPicker from '@/components/common/emoji-picker.vue';
  import EmbedPreview from '@/components/github/embed-preview.vue';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import {
    Dialog,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogScrollContent,
    DialogTitle,
  } from '@/components/ui/dialog';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Separator } from '@/components/ui/separator';
  import { Switch } from '@/components/ui/switch';
  import { Textarea } from '@/components/ui/textarea';
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

  const actorHint = computed(() => actorLabels[props.eventKey]);

  function hintFor(name: string): string {
    return name === 'actor'
      ? `${variableHints.actor} — ${actorHint.value}`
      : (variableHints[name] ?? '');
  }

  function addField(): void {
    if (draft.value.fields.length >= MAX_FIELDS) {
      return;
    }

    draft.value.fields = [...draft.value.fields, { name: '', value: '', inline: true }];
  }

  function removeField(index: number): void {
    draft.value.fields = draft.value.fields.filter((_, item) => item !== index);
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
            <code>{{ '{actor}' }}</code> 는 이 이벤트에서 <strong>{{ actorHint }}</strong> 입니다.
            <code>{name|있을 때|없을 때}</code> 로 값 유무에 따라 문구를 바꾸고, 분기 안의
            <code>{}</code> 자리에 값이 들어갑니다.
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label :for="`tpl-content-${eventKey}`">알림 줄 (임베드 위 평문)</Label>
          <div class="flex gap-2">
            <Input
              :id="`tpl-content-${eventKey}`"
              v-model="draft.content"
              class="font-gothic"
              :disabled="readOnly"
              placeholder="{mentions}"
              @focus="onFocus"
            />
            <EmojiPicker :disabled="readOnly" @pick="insert" />
          </div>
          <p class="text-muted-foreground text-xs">
            디스코드는 임베드 안의 멘션으로 알림을 울리지 않습니다. 실제로 사람을 부르려면 멘션은 이
            줄에 있어야 합니다.
          </p>
          <p class="text-muted-foreground text-xs">
            서버 이모지는 <code>:이름:</code> 으로 들어가고, 발송할 때 실제 이모지로 바뀝니다.
          </p>
        </div>

        <Separator />

        <div class="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div class="flex flex-col gap-1.5">
            <Label :for="`tpl-title-${eventKey}`">제목</Label>
            <div class="flex gap-2">
              <Input
                :id="`tpl-title-${eventKey}`"
                v-model="draft.title"
                class="font-gothic"
                :disabled="readOnly"
                @focus="onFocus"
              />
              <EmojiPicker :disabled="readOnly" @pick="insert" />
            </div>
            <p class="text-muted-foreground text-xs">제목에는 PR·Issue 링크가 자동으로 걸립니다.</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label :for="`tpl-color-${eventKey}`">색</Label>
            <div class="flex items-center gap-2">
              <input
                :id="`tpl-color-${eventKey}`"
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
          <Label :for="`tpl-desc-${eventKey}`">내용</Label>
          <div class="flex gap-2">
            <Textarea
              :id="`tpl-desc-${eventKey}`"
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
            <Label :for="`tpl-footer-${eventKey}`">꼬리말</Label>
            <div class="flex gap-2">
              <Input
                :id="`tpl-footer-${eventKey}`"
                v-model="draft.footer"
                class="font-gothic"
                :disabled="readOnly"
                @focus="onFocus"
              />
              <EmojiPicker :disabled="readOnly" @pick="insert" />
            </div>
          </div>
          <div class="flex items-center gap-3 pb-1">
            <Label :for="`tpl-time-${eventKey}`" class="font-normal">시간 표시</Label>
            <Switch
              :id="`tpl-time-${eventKey}`"
              v-model="draft.showTimestamp"
              :disabled="readOnly"
            />
          </div>
        </div>

        <Separator />

        <div class="flex flex-col gap-2">
          <p class="text-sm font-medium">미리보기</p>
          <EmbedPreview :template="draft" :variables="variables" />
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
