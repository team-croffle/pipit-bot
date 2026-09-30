<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue';

  import { Input } from '@/components/ui/input';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';

  /**
   * Picks a repository (`owner/name`) from the list the App is installed on, with
   * "직접 입력" as the way out — the same shape as the role and account pickers.
   *
   * WHY the escape hatch: the list is fetched lazily on first open and is not
   * authoritative. A repository can be configured before the App is installed on
   * it, and the App credentials are optional entirely, so a typed value stays
   * first-class. A saved value that the list does not know opens in manual mode
   * rather than looking empty — but only once the list has actually arrived.
   */
  const props = defineProps<{
    modelValue: string;
    /** Full names, `owner/name`. */
    options: string[];
    loading?: boolean;
    disabled?: boolean;
    id?: string;
    placeholder?: string;
  }>();

  const emit = defineEmits<{ 'update:modelValue': [string]; open: [] }>();

  // See channel-select: reka-ui treats '' as "no selection".
  const EMPTY = '__none__';
  const MANUAL = '__manual__';

  const known = computed(() => props.options.includes(props.modelValue));

  // Set once the parent has been asked for the list; before that an empty list
  // only means "not fetched yet" and must not push the field into manual mode.
  const requested = ref(false);
  const manual = ref(false);
  // Manual because the list came back empty — the hint says so.
  const emptyList = computed(() => requested.value && !props.loading && props.options.length === 0);

  function settle(): void {
    if (props.loading || !requested.value) {
      return;
    }

    if (props.options.length === 0 || (props.modelValue && !known.value)) {
      manual.value = true;
    }
  }

  watch(() => [props.modelValue, props.options.length, props.loading] as const, settle, {
    immediate: true,
  });

  function onOpen(open: boolean): void {
    if (!open) {
      return;
    }

    requested.value = true;
    emit('open');
    // The parent flips `loading` synchronously in its handler; by the next tick we
    // know whether a fetch is on its way or the list is final and empty.
    void nextTick(settle);
  }

  const selected = computed({
    get: () => (props.modelValue && known.value ? props.modelValue : EMPTY),
    set: (next: string) => {
      if (next === MANUAL) {
        manual.value = true;
        emit('update:modelValue', '');
        return;
      }

      manual.value = false;
      emit('update:modelValue', next === EMPTY ? '' : next);
    },
  });
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <Input
      v-if="manual"
      :id="id"
      :model-value="modelValue"
      :disabled="disabled"
      :placeholder="placeholder ?? 'owner/name 또는 name'"
      class="font-gothic"
      autocomplete="off"
      @update:model-value="emit('update:modelValue', String($event))"
    />
    <Select v-else v-model="selected" :disabled="disabled" @update:open="onOpen">
      <SelectTrigger :id="id" class="w-full">
        <SelectValue placeholder="저장소 선택">
          <span v-if="modelValue" class="font-gothic truncate">{{ modelValue }}</span>
          <span v-else-if="loading" class="text-muted-foreground">목록을 불러오는 중…</span>
          <span v-else>저장소 선택</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div v-if="loading" class="text-muted-foreground px-2 py-1.5 text-sm">
          목록을 불러오는 중…
        </div>
        <SelectItem v-for="option in options" :key="option" :value="option">
          <span class="font-gothic truncate">{{ option }}</span>
        </SelectItem>
        <SelectItem :value="MANUAL">직접 입력…</SelectItem>
      </SelectContent>
    </Select>
    <p v-if="manual && emptyList" class="text-muted-foreground text-xs">
      설치된 저장소 목록이 없습니다 — 직접 입력
    </p>
    <button
      v-else-if="manual && options.length > 0"
      type="button"
      class="text-muted-foreground hover:text-foreground self-start text-xs underline"
      :disabled="disabled"
      @click="manual = false"
    >
      목록에서 고르기
    </button>
  </div>
</template>
