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
  import type { GithubMember } from '@/types';

  /**
   * Picks a GitHub account, matching the Discord member picker beside it.
   *
   * WHY a dropdown with an escape hatch rather than the datalist this replaced: the
   * two halves of a mapping row read as a pair, and only one of them looking like a
   * list made the other seem to have none. But the list still is not authoritative —
   * an account can be mapped before the person joins the organisation, and the App
   * credentials are optional entirely — so "직접 입력" stays as a way out.
   */
  const props = defineProps<{
    modelValue: string;
    members: GithubMember[];
    loading?: boolean;
    disabled?: boolean;
    id?: string;
  }>();

  const emit = defineEmits<{ 'update:modelValue': [string]; open: [] }>();

  const current = computed(() =>
    props.members.find((member) => member.login.toLowerCase() === props.modelValue.toLowerCase()),
  );

  // A value that is not in the list has to render as typed, so the row opens in
  // manual mode rather than looking empty — once the list has actually arrived.
  const { manual, onOpen, pick } = useManualFallback({
    value: () => props.modelValue,
    known: () => current.value !== undefined,
    count: () => props.members.length,
    loading: () => props.loading,
    requestList: () => emit('open'),
  });

  const selected = computed({
    get: () => (current.value ? current.value.login : EMPTY),
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
      placeholder="GitHub 계정"
      class="font-gothic"
      autocomplete="off"
      @update:model-value="emit('update:modelValue', String($event))"
    />
    <Select v-else v-model="selected" :disabled="disabled" @update:open="onOpen">
      <SelectTrigger :id="id" class="w-full min-w-0">
        <SelectValue placeholder="GitHub 계정 선택">
          <span v-if="current" class="flex min-w-0 items-center gap-2">
            <img
              v-if="current.avatarUrl"
              :src="current.avatarUrl"
              alt=""
              class="size-5 shrink-0 rounded-full"
            />
            <span class="font-gothic truncate">{{ current.login }}</span>
          </span>
          <span v-else-if="modelValue" class="font-gothic truncate">{{ modelValue }}</span>
          <span v-else-if="loading" class="text-muted-foreground">{{ PICKER_TEXT.loading }}</span>
          <span v-else>GitHub 계정 선택</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div v-if="loading" class="text-muted-foreground px-2 py-1.5 text-sm">
          {{ PICKER_TEXT.loading }}
        </div>
        <div v-else-if="members.length === 0" class="text-muted-foreground px-2 py-1.5 text-sm">
          가져온 계정이 없습니다 — 직접 입력하세요.
        </div>
        <SelectItem v-for="member in members" :key="member.login" :value="member.login">
          <span class="flex min-w-0 items-center gap-2">
            <img
              v-if="member.avatarUrl"
              :src="member.avatarUrl"
              alt=""
              class="size-5 shrink-0 rounded-full"
            />
            <span class="font-gothic truncate">{{ member.login }}</span>
          </span>
        </SelectItem>
        <SelectItem :value="MANUAL">{{ PICKER_TEXT.manual }}</SelectItem>
      </SelectContent>
    </Select>
    <button
      v-if="manual && members.length > 0"
      type="button"
      class="text-muted-foreground hover:text-foreground self-start text-xs underline"
      :disabled="disabled"
      @click="manual = false"
    >
      {{ PICKER_TEXT.back }}
    </button>
  </div>
</template>
