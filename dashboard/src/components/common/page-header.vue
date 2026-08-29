<script setup lang="ts">
  defineProps<{ title: string; description?: string }>();
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div class="min-w-0">
      <h1 class="text-xl font-semibold tracking-tight text-balance">{{ title }}</h1>
      <p v-if="description" class="text-muted-foreground mt-1 text-sm">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
