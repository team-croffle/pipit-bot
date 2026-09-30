<script setup lang="ts">
  import { computed, ref, watch } from 'vue';

  import { Input } from '@/components/ui/input';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
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

  // See channel-select: reka-ui treats '' as "no selection".
  const EMPTY = '__none__';
  const MANUAL = '__manual__';

  const current = computed(() => props.roles.find((role) => role.id === props.modelValue));

  // An id that is not in the list has to render as typed, so the row opens in
  // manual mode rather than looking empty — but not while the list is still on its way.
  const manual = ref(false);

  watch(
    () => [props.modelValue, props.roles.length, props.loading, props.unavailable] as const,
    () => {
      if (props.unavailable || (props.modelValue && !props.loading && !current.value)) {
        manual.value = true;
      }
    },
    { immediate: true },
  );

  const selected = computed({
    get: () => (current.value ? props.modelValue : EMPTY),
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
      placeholder="역할 ID"
      class="font-gothic"
      autocomplete="off"
      inputmode="numeric"
      @update:model-value="emit('update:modelValue', String($event))"
    />
    <Select v-else v-model="selected" :disabled="disabled" @update:open="$event && emit('open')">
      <SelectTrigger :id="id" class="w-full">
        <SelectValue placeholder="역할 선택">
          <span v-if="current" class="truncate">@{{ current.name }}</span>
          <span v-else-if="loading" class="text-muted-foreground">역할 불러오는 중…</span>
          <span v-else>역할 선택</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div v-if="loading" class="text-muted-foreground px-2 py-1.5 text-sm">불러오는 중…</div>
        <div v-else-if="roles.length === 0" class="text-muted-foreground px-2 py-1.5 text-sm">
          가져온 역할이 없습니다 — 직접 입력하세요.
        </div>
        <SelectItem v-for="role in roles" :key="role.id" :value="role.id">
          @{{ role.name }}
        </SelectItem>
        <SelectItem :value="MANUAL">직접 입력…</SelectItem>
      </SelectContent>
    </Select>
    <button
      v-if="manual && !unavailable && roles.length > 0"
      type="button"
      class="text-muted-foreground hover:text-foreground self-start text-xs underline"
      :disabled="disabled"
      @click="manual = false"
    >
      목록에서 고르기
    </button>
  </div>
</template>
