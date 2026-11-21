<script setup lang="ts">
  import { computed } from 'vue';
  import { useI18n } from 'vue-i18n';

  import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import { EMPTY } from '@/lib/picker';
  import type { DiscordChannel } from '@/types';

  /**
   * WHY the grouping: channel names are only unique within a category, so a picker
   * listing bare names can show the same label twice with no way to tell them apart.
   * A channel the bot cannot post in stays visible but disabled — hiding it would
   * leave an already-configured channel with no explanation.
   */
  const props = defineProps<{
    modelValue: string | null;
    channels: DiscordChannel[];
    /** Label for the "inherit / none" entry; omit to leave the picker without one. */
    placeholder?: string;
    /** What an unset picker stores — `null` for settings that persist null, `''` elsewhere. */
    emptyValue?: string | null;
    disabled?: boolean;
    id?: string;
  }>();

  const emit = defineEmits<{ 'update:modelValue': [string | null] }>();

  const { t } = useI18n();
  // Both of our empty shapes (null and '') ride through the Select as EMPTY and
  // are mapped back on the way out.

  const groups = computed(() => {
    const result: { category: string; channels: DiscordChannel[] }[] = [];
    for (const channel of props.channels) {
      const category = channel.category ?? t('pickers.uncategorized');
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
    get: () => props.modelValue ?? EMPTY,
    set: (next: string) => {
      emit('update:modelValue', next === EMPTY ? (props.emptyValue ?? null) : next);
    },
  });

  const label = computed(() => {
    const current = props.channels.find((channel) => channel.id === props.modelValue);
    return current ? `#${current.name}` : (props.placeholder ?? t('pickers.choose'));
  });
</script>

<template>
  <Select v-model="selected" :disabled="disabled">
    <SelectTrigger :id="id" class="w-full min-w-0">
      <SelectValue :placeholder="placeholder ?? t('pickers.choose')">{{ label }}</SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-if="placeholder" :value="EMPTY">{{ placeholder }}</SelectItem>
      <SelectGroup v-for="group in groups" :key="group.category">
        <SelectLabel>{{ group.category }}</SelectLabel>
        <SelectItem
          v-for="channel in group.channels"
          :key="channel.id"
          :value="channel.id"
          :disabled="!channel.canPost"
          :data-channel-option="channel.id"
        >
          #{{ channel.name }}{{ channel.canPost ? '' : t('pickers.cannotPost') }}
        </SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
</template>
