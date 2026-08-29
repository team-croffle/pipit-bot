<script setup lang="ts">
  import type { Component } from 'vue';

  import { Card, CardContent } from '@/components/ui/card';

  defineProps<{ label: string; value: string; hint?: string; icon?: Component }>();
</script>

<template>
  <Card class="gap-0 py-4">
    <CardContent class="px-4">
      <div class="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <component :is="icon" v-if="icon" class="size-3.5" />
        <span class="truncate">{{ label }}</span>
      </div>
      <p class="tnum mt-1.5 text-2xl leading-tight font-semibold tracking-tight">{{ value }}</p>
      <p v-if="hint" class="text-muted-foreground mt-1 truncate text-xs">{{ hint }}</p>
    </CardContent>
  </Card>
</template>
