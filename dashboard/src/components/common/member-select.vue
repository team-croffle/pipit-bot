<script setup lang="ts">
  import { computed } from 'vue';

  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import type { DiscordMember } from '@/types';

  const props = defineProps<{
    modelValue: string;
    members: DiscordMember[];
    loading?: boolean;
    disabled?: boolean;
    id?: string;
  }>();

  const emit = defineEmits<{ 'update:modelValue': [string]; open: [] }>();

  // See channel-select: reka-ui treats '' as "no selection".
  const EMPTY = '__none__';

  const selected = computed({
    get: () => props.modelValue || EMPTY,
    set: (next: string) => emit('update:modelValue', next === EMPTY ? '' : next),
  });

  const current = computed(() => props.members.find((member) => member.id === props.modelValue));

  function initials(name: string): string {
    return name.slice(0, 2).toUpperCase();
  }
</script>

<template>
  <Select v-model="selected" :disabled="disabled" @update:open="$event && emit('open')">
    <SelectTrigger :id="id" class="w-full">
      <SelectValue placeholder="멤버 선택">
        <span v-if="current" class="flex min-w-0 items-center gap-2">
          <img
            v-if="current.avatarUrl"
            :src="current.avatarUrl"
            alt=""
            class="size-5 shrink-0 rounded-full"
          />
          <span class="truncate">{{ current.name }}</span>
        </span>
        <!-- A mapping saved before the member list loaded still has to render. -->
        <span v-else-if="modelValue" class="font-gothic truncate text-xs">{{ modelValue }}</span>
        <span v-else>멤버 선택</span>
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      <div v-if="loading" class="text-muted-foreground px-2 py-1.5 text-sm">불러오는 중…</div>
      <div v-else-if="members.length === 0" class="text-muted-foreground px-2 py-1.5 text-sm">
        가져온 멤버가 없습니다.
      </div>
      <SelectItem v-for="member in members" :key="member.id" :value="member.id">
        <span class="flex min-w-0 items-center gap-2">
          <img
            v-if="member.avatarUrl"
            :src="member.avatarUrl"
            alt=""
            class="size-5 shrink-0 rounded-full"
          />
          <span
            v-else
            class="bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-semibold"
            aria-hidden="true"
          >
            {{ initials(member.name) }}
          </span>
          <span class="truncate">{{ member.name }}</span>
        </span>
      </SelectItem>
    </SelectContent>
  </Select>
</template>
