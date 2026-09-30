<script setup lang="ts">
  import { computed } from 'vue';

  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import { EMPTY } from '@/lib/picker';

  /** A flat picker for the id/name lists the bot returns (roles, guild members). */
  const props = defineProps<{
    modelValue: string;
    options: { id: string; name: string }[];
    placeholder: string;
    disabled?: boolean;
    id?: string;
  }>();

  const emit = defineEmits<{ 'update:modelValue': [string] }>();

  const selected = computed({
    get: () => props.modelValue || EMPTY,
    set: (next: string) => emit('update:modelValue', next === EMPTY ? '' : next),
  });

  const label = computed(
    () => props.options.find((option) => option.id === props.modelValue)?.name ?? props.placeholder,
  );
</script>

<template>
  <Select v-model="selected" :disabled="disabled">
    <SelectTrigger :id="id" class="w-full">
      <SelectValue :placeholder="placeholder">{{ label }}</SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectItem :value="EMPTY">{{ placeholder }}</SelectItem>
      <SelectItem v-for="option in options" :key="option.id" :value="option.id">
        {{ option.name }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
