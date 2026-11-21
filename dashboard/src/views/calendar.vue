<script setup lang="ts">
  import { CalendarDays } from 'lucide-vue-next';
  import { computed } from 'vue';
  import { useI18n } from 'vue-i18n';

  import PlannedView from '@/components/common/planned-view.vue';

  const { t, tm, rt } = useI18n();
  const points = computed(() =>
    (tm('planned.calendar.points') as string[]).map((point) => rt(point)),
  );
</script>

<template>
  <PlannedView
    :title="t('planned.calendar.title')"
    :description="t('planned.calendar.description')"
    version="v0.9"
    :icon="CalendarDays"
    :points="points"
  />
</template>
