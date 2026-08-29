<script setup lang="ts">
  import { ListChecks } from 'lucide-vue-next';

  import PlannedView from '@/components/common/planned-view.vue';
</script>

<template>
  <PlannedView
    title="투표"
    description="croffle-polls 의견 취합 시스템 연동"
    version="v1.1"
    :icon="ListChecks"
    :points="[
      '대시보드와 디스코드에서 투표 생성',
      '익명 투표 지원',
      '진행 중인 투표 현황과 결과 조회',
      'croffle 일정관리 시스템 연동(v1.1.2)과 함께 정리됩니다',
    ]"
  />
</template>
