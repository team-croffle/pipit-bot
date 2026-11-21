<script setup lang="ts">
  import { Monitor, Moon, Sun } from 'lucide-vue-next';
  import { useI18n } from 'vue-i18n';

  import { useTheme, type ThemeChoice } from '@/composables/use-theme';

  const { current, set } = useTheme();

  const { t } = useI18n();
  const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'common.themeLight', icon: Sun },
    { value: 'dark', label: 'common.themeDark', icon: Moon },
    { value: 'auto', label: 'common.themeAuto', icon: Monitor },
  ];
</script>

<template>
  <div
    class="bg-muted/60 inline-flex items-center gap-0.5 rounded-lg border p-0.5"
    role="group"
    :aria-label="t('common.themeChoose')"
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
      :title="t(option.label)"
      @click="set(option.value)"
    >
      <component :is="option.icon" class="size-4" />
      <span class="sr-only">{{ t(option.label) }}</span>
    </button>
  </div>
</template>
