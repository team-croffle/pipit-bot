<script setup lang="ts">
  import { CalendarDays } from 'lucide-vue-next';

  import PlannedView from '@/components/common/planned-view.vue';
</script>

<template>
  <PlannedView
    title="캘린더 연동"
    description="Google 캘린더를 읽어 일정과 생일을 안내"
    version="v0.9"
    :icon="CalendarDays"
    :points="[
      '팀 캘린더에 대한 읽기 권한만 요청',
      '생일자 알림',
      '회의 시작 전 알림',
      '제품 릴리즈 및 팀 자체 일정 알림',
    ]"
  />
</template>
