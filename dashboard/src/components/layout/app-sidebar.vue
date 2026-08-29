<script setup lang="ts">
  import AppNav from './app-nav.vue';
  import BrandMark from './brand-mark.vue';
  import ThemeToggle from './theme-toggle.vue';

  defineProps<{ version?: string }>();
  const emit = defineEmits<{ navigate: [] }>();
</script>

<template>
  <div class="bg-sidebar text-sidebar-foreground flex h-full flex-col gap-5 p-3">
    <div class="flex items-center gap-2.5 px-1.5 pt-1">
      <BrandMark :size="36" />
      <div class="min-w-0 leading-tight">
        <p class="font-jua truncate text-base tracking-tight">pipit-hub</p>
        <p class="text-muted-foreground truncate text-xs">Team Croffle 관제 센터</p>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <AppNav @navigate="emit('navigate')" />
    </div>

    <div class="border-sidebar-border flex items-center justify-between gap-2 border-t px-1.5 pt-3">
      <span
        class="text-muted-foreground font-gothic text-xs bg-muted rounded-sm px-2 py-1 border border-muted-foreground/10"
        >{{ version ?? 'dashboard' }}</span
      >
      <ThemeToggle />
    </div>
  </div>
</template>
