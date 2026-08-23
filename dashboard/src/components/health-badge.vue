<script setup lang="ts">
  defineProps<{
    status: string;
  }>();
</script>

<template>
  <div class="health-badge" :class="status === 'ok' ? 'ok' : 'bad'">
    <span class="dot" aria-hidden="true"></span>
    <span>API {{ status }}</span>
  </div>
</template>
