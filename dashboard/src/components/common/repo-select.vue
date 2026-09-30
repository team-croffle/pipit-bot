<script setup lang="ts">
  import { computed } from 'vue';

  import { Input } from '@/components/ui/input';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import { EMPTY, MANUAL, PICKER_TEXT, useManualFallback } from '@/lib/picker';

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

  const known = computed(() => props.options.includes(props.modelValue));

  const { manual, emptyList, onOpen, pick } = useManualFallback({
    value: () => props.modelValue,
    known: () => known.value,
    count: () => props.options.length,
    loading: () => props.loading,
    requestList: () => emit('open'),
  });

  const selected = computed({
    get: () => (props.modelValue && known.value ? props.modelValue : EMPTY),
    set: (next: string) => emit('update:modelValue', pick(next)),
  });
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
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
      <SelectTrigger :id="id" class="w-full min-w-0">
        <SelectValue placeholder="저장소 선택">
          <span v-if="modelValue" class="font-gothic truncate">{{ modelValue }}</span>
          <span v-else-if="loading" class="text-muted-foreground">{{ PICKER_TEXT.loading }}</span>
          <span v-else>저장소 선택</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div v-if="loading" class="text-muted-foreground px-2 py-1.5 text-sm">
          {{ PICKER_TEXT.loading }}
        </div>
        <SelectItem v-for="option in options" :key="option" :value="option">
          <span class="font-gothic truncate">{{ option }}</span>
        </SelectItem>
        <SelectItem :value="MANUAL">{{ PICKER_TEXT.manual }}</SelectItem>
      </SelectContent>
    </Select>
    <p v-if="manual && emptyList" class="text-muted-foreground text-xs">
      설치된 저장소 목록이 없습니다 — 직접 입력하세요.
    </p>
    <button
      v-else-if="manual && options.length > 0"
      type="button"
      class="text-muted-foreground hover:text-foreground self-start text-xs underline"
      :disabled="disabled"
      @click="manual = false"
    >
      {{ PICKER_TEXT.back }}
    </button>
  </div>
</template>
