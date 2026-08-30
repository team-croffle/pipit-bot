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

  // See channel-select: reka-ui treats '' as "no selection".
  const EMPTY = '__none__';
  const MANUAL = '__manual__';

  const known = computed(() =>
    props.members.some((member) => member.login.toLowerCase() === props.modelValue.toLowerCase()),
  );

  // A value that is not in the list has to render as typed, so the row opens in
  // manual mode rather than looking empty.
  const manual = ref(Boolean(props.modelValue) && !known.value);

  watch(
    () => [props.modelValue, props.members.length] as const,
    () => {
      if (props.modelValue && !known.value) {
        manual.value = true;
      }
    },
  );

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

  const current = computed(() =>
    props.members.find((member) => member.login.toLowerCase() === props.modelValue.toLowerCase()),
  );
</script>

<template>
  <div class="flex flex-col gap-1.5">
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
    <Select v-else v-model="selected" :disabled="disabled" @update:open="$event && emit('open')">
      <SelectTrigger :id="id" class="w-full">
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
          <span v-else>GitHub 계정 선택</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div v-if="loading" class="text-muted-foreground px-2 py-1.5 text-sm">불러오는 중…</div>
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
        <SelectItem :value="MANUAL">직접 입력…</SelectItem>
      </SelectContent>
    </Select>
    <button
      v-if="manual && members.length > 0"
      type="button"
      class="text-muted-foreground hover:text-foreground self-start text-xs underline"
      :disabled="disabled"
      @click="manual = false"
    >
      목록에서 고르기
    </button>
  </div>
</template>
