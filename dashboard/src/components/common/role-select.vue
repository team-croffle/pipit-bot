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
  import type { DiscordRole } from '@/types';

  /**
   * Picks a guild role by id, with "직접 입력" as the way out — the same shape as the
   * account picker beside the member picker. WHY the escape hatch: the role list is
   * fetched lazily and can fail (guild not ready), and a saved mapping still has to
   * render and stay editable when it does; an id typed by hand is what the server
   * validates anyway.
   */
  const props = defineProps<{
    modelValue: string;
    roles: DiscordRole[];
    loading?: boolean;
    /** The list could not be fetched — only manual entry is offered. */
    unavailable?: boolean;
    disabled?: boolean;
    id?: string;
  }>();

  const emit = defineEmits<{ 'update:modelValue': [string]; open: [] }>();

  const current = computed(() => props.roles.find((role) => role.id === props.modelValue));

  // An id the list does not know has to render as typed, so the row opens in
  // manual mode rather than looking empty — once the list has actually arrived.
  const { manual, onOpen, pick } = useManualFallback({
    value: () => props.modelValue,
    known: () => current.value !== undefined,
    count: () => props.roles.length,
    loading: () => props.loading,
    unavailable: () => props.unavailable,
    requestList: () => emit('open'),
  });

  const selected = computed({
    get: () => (current.value ? props.modelValue : EMPTY),
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
      placeholder="역할 ID"
      class="font-gothic"
      autocomplete="off"
      inputmode="numeric"
      @update:model-value="emit('update:modelValue', String($event))"
    />
    <Select v-else v-model="selected" :disabled="disabled" @update:open="onOpen">
      <SelectTrigger :id="id" class="w-full min-w-0">
        <SelectValue placeholder="역할 선택">
          <span v-if="current" class="truncate">@{{ current.name }}</span>
          <span v-else-if="modelValue" class="font-gothic truncate">{{ modelValue }}</span>
          <span v-else-if="loading" class="text-muted-foreground">{{ PICKER_TEXT.loading }}</span>
          <span v-else>역할 선택</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div v-if="loading" class="text-muted-foreground px-2 py-1.5 text-sm">
          {{ PICKER_TEXT.loading }}
        </div>
        <div v-else-if="roles.length === 0" class="text-muted-foreground px-2 py-1.5 text-sm">
          가져온 역할이 없습니다 — 직접 입력하세요.
        </div>
        <SelectItem v-for="role in roles" :key="role.id" :value="role.id">
          @{{ role.name }}
        </SelectItem>
        <SelectItem :value="MANUAL">{{ PICKER_TEXT.manual }}</SelectItem>
      </SelectContent>
    </Select>
    <button
      v-if="manual && !unavailable && roles.length > 0"
      type="button"
      class="text-muted-foreground hover:text-foreground self-start text-xs underline"
      :disabled="disabled"
      @click="manual = false"
    >
      {{ PICKER_TEXT.back }}
    </button>
  </div>
</template>
