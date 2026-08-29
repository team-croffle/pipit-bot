<script setup lang="ts">
  import { Monitor, Moon, Sun } from 'lucide-vue-next';

  import { useTheme, type ThemeChoice } from '@/composables/use-theme';

  const { current, set } = useTheme();

  const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: '라이트 테마', icon: Sun },
    { value: 'dark', label: '다크 테마', icon: Moon },
    { value: 'auto', label: '시스템 설정 따르기', icon: Monitor },
  ];
</script>

<template>
  <div
    class="bg-muted/60 inline-flex items-center gap-0.5 rounded-lg border p-0.5"
    role="group"
    aria-label="테마 선택"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="focus-visible:ring-ring/50 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      :class="
        current === option.value
          ? 'bg-background text-primary shadow-xs'
          : 'text-muted-foreground hover:text-foreground'
      "
      :aria-pressed="current === option.value"
      :title="option.label"
      @click="set(option.value)"
    >
      <component :is="option.icon" class="size-3.5" />
      <span class="sr-only">{{ option.label }}</span>
    </button>
  </div>
</template>
