<script setup lang="ts">
  import { computed } from 'vue';

  import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import { EMPTY, PICKER_TEXT } from '@/lib/picker';
  import type { DiscordVoiceChannel } from '@/types';

  /**
   * The voice-channel sibling of `ChannelSelect`: grouped by category for the same
   * reason (names repeat across categories), with the number of people in each room
   * so an empty one — which the player leaves on its own — is visible before it is
   * picked. A room the bot may not join stays listed but disabled.
   */
  const props = defineProps<{
    modelValue: string;
    channels: DiscordVoiceChannel[];
    loading?: boolean;
    disabled?: boolean;
    id?: string;
  }>();

  const emit = defineEmits<{ 'update:modelValue': [string]; open: [] }>();

  const UNCATEGORIZED = '카테고리 없음';
  const PLACEHOLDER = '통화방 선택';

  const groups = computed(() => {
    const result: { category: string; channels: DiscordVoiceChannel[] }[] = [];
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

  const selected = computed({
    get: () => props.modelValue || EMPTY,
    set: (next: string) => emit('update:modelValue', next === EMPTY ? '' : next),
  });

  const label = computed(() => {
    if (!props.modelValue) {
      return props.loading ? PICKER_TEXT.loading : PLACEHOLDER;
    }

    // Before the list arrives the id is all there is; show it rather than a blank.
    return (
      props.channels.find((channel) => channel.id === props.modelValue)?.name ?? props.modelValue
    );
  });

  function onOpen(open: boolean): void {
    if (open) {
      emit('open');
    }
  }
</script>

<template>
  <Select v-model="selected" :disabled="disabled" @update:open="onOpen">
    <SelectTrigger :id="id" class="w-full min-w-0">
      <SelectValue :placeholder="PLACEHOLDER">
        <span class="truncate">{{ label }}</span>
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      <p v-if="loading && !channels.length" class="text-muted-foreground px-2 py-1.5 text-sm">
        {{ PICKER_TEXT.loading }}
      </p>
      <p v-else-if="!channels.length" class="text-muted-foreground px-2 py-1.5 text-sm">
        이 서버에 통화방이 없습니다.
      </p>
      <SelectGroup v-for="group in groups" :key="group.category">
        <SelectLabel>{{ group.category }}</SelectLabel>
        <SelectItem
          v-for="channel in group.channels"
          :key="channel.id"
          :value="channel.id"
          :disabled="!channel.canJoin"
        >
          <span class="truncate">{{ channel.name }}</span>
          <span class="text-muted-foreground tnum text-xs">
            {{ channel.memberCount }}명{{ channel.canJoin ? '' : ' — 봇이 참여할 수 없음' }}
          </span>
        </SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
</template>
