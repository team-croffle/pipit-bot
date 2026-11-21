<script setup lang="ts">
  import { ListChecks } from 'lucide-vue-next';
  import { computed } from 'vue';
  import { useI18n } from 'vue-i18n';

  import PlannedView from '@/components/common/planned-view.vue';

  const { t, tm, rt } = useI18n();
  const points = computed(() => (tm('planned.polls.points') as string[]).map((point) => rt(point)));
</script>

<template>
  <PlannedView
    :title="t('planned.polls.title')"
    :description="t('planned.polls.description')"
    version="v0.10"
    :icon="ListChecks"
    :points="points"
  />
</template>
