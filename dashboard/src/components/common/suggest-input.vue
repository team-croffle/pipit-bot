<script setup lang="ts">
  import { Input } from '@/components/ui/input';

  /**
   * A text field that offers what the server knows without insisting on it.
   *
   * WHY a native datalist rather than a Select: neither list is authoritative. A
   * repository can be configured before the App is installed on it, an account can be
   * mapped before the person joins the org, and the App credentials are optional
   * entirely — so the typed value has to stay first-class. A datalist suggests and
   * gets out of the way; a Select would make the unlisted case impossible.
   */
  const props = defineProps<{
    modelValue: string;
    /** Suggestions; an empty list simply leaves a plain text field. */
    options: string[];
    listId: string;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    loading?: boolean;
  }>();

  const emit = defineEmits<{ 'update:modelValue': [string]; open: [] }>();

  function onInput(value: string | number): void {
    emit('update:modelValue', String(value));
  }
</script>

<template>
  <div class="flex flex-col gap-1">
    <Input
      :id="id"
      :model-value="modelValue"
      :list="options.length > 0 ? listId : undefined"
      :placeholder="placeholder"
      :disabled="disabled"
      class="font-gothic"
      autocomplete="off"
      @focus="emit('open')"
      @update:model-value="onInput"
    />
    <datalist :id="listId">
      <option v-for="option in options" :key="option" :value="option" />
    </datalist>
    <p v-if="loading" class="text-muted-foreground text-xs">목록을 불러오는 중…</p>
  </div>
</template>
