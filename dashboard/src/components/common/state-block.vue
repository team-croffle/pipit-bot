<script setup lang="ts">
  import { useI18n } from 'vue-i18n';

  import { Skeleton } from '@/components/ui/skeleton';

  /**
   * The three states every panel has to answer for (AGENTS.md §4): still loading,
   * failed, or loaded but with nothing to show.
   */
  defineProps<{ loading?: boolean; error?: string; empty?: boolean; emptyText?: string }>();
  const { t } = useI18n();
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-2" role="status" aria-live="polite">
    <Skeleton class="h-4 w-2/5" />
    <Skeleton class="h-4 w-4/5" />
    <Skeleton class="h-4 w-3/5" />
    <span class="sr-only">{{ t('common.loading') }}</span>
  </div>
  <p v-else-if="error" class="text-destructive text-sm" role="alert">{{ error }}</p>
  <p v-else-if="empty" class="text-muted-foreground text-sm">
    {{ emptyText ?? t('common.empty') }}
  </p>
  <slot v-else />
</template>
