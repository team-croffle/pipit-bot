<script setup lang="ts">
  defineProps<{
    status: string;
  }>();
</script>

<template>
  <div
    class="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium"
    :class="
      status === 'ok'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
        : 'border-red-500/30 bg-red-500/10 text-red-400'
    "
  >
    <span
      class="h-2 w-2 rounded-full"
      :class="status === 'ok' ? 'bg-emerald-400' : 'bg-red-400'"
      aria-hidden="true"
    ></span>
    <span>API {{ status }}</span>
  </div>
</template>
