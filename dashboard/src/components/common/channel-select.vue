<script setup lang="ts">
  import { computed } from 'vue';

  import {
    NativeSelect,
    NativeSelectOptGroup,
    NativeSelectOption,
  } from '@/components/ui/native-select';
  import type { DiscordChannel } from '@/types';

  /**
   * WHY a native select: channel names are only unique within a category, so the
   * picker has to group them, and a channel the bot cannot post in stays visible but
   * disabled — hiding it would leave an already-configured channel with no explanation.
   */
  const props = defineProps<{
    modelValue: string | null;
    channels: DiscordChannel[];
    /** Label for the "inherit / none" entry; omit to require a channel. */
    placeholder?: string;
    /** Value the placeholder carries — `null` for settings that store null. */
    placeholderValue?: string | null;
    disabled?: boolean;
    id?: string;
  }>();

  const emit = defineEmits<{ 'update:modelValue': [string | null] }>();

  const UNCATEGORIZED = '카테고리 없음';

  const groups = computed(() => {
    const result: { category: string; channels: DiscordChannel[] }[] = [];
    for (const channel of props.channels) {
      const category = channel.category ?? UNCATEGORIZED;
      const last = result.at(-1);
      if (last?.category === category) {
        last.channels.push(channel);
        continue;
      }

      result.push({ category, channels: [channel] });
    }

    return result;
  });

  const value = computed({
    get: () => props.modelValue,
    set: (next) => emit('update:modelValue', next),
  });
</script>

<template>
  <NativeSelect :id="id" v-model="value" :disabled="disabled" class="w-full">
    <NativeSelectOption v-if="placeholder" :value="placeholderValue ?? null">
      {{ placeholder }}
    </NativeSelectOption>
    <NativeSelectOptGroup v-for="group in groups" :key="group.category" :label="group.category">
      <NativeSelectOption
        v-for="channel in group.channels"
        :key="channel.id"
        :value="channel.id"
        :disabled="!channel.canPost"
      >
        {{ channel.name }}{{ channel.canPost ? '' : ' — 봇이 글을 쓸 수 없음' }}
      </NativeSelectOption>
    </NativeSelectOptGroup>
  </NativeSelect>
</template>
