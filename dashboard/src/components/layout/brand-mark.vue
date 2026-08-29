<script setup lang="ts">
  import markUrl from '@/assets/pipit-mark.png';

  withDefaults(defineProps<{ size?: number }>(), { size: 36 });
</script>

<template>
  <img
    :src="markUrl"
    :width="size"
    :height="size"
    alt=""
    aria-hidden="true"
    class="shrink-0 object-contain"
  />
</template>
