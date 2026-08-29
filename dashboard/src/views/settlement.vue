<script setup lang="ts">
  import { BarChart3 } from 'lucide-vue-next';

  import PlannedView from '@/components/common/planned-view.vue';
</script>

<template>
  <PlannedView
    title="음악 결산"
    description="월말·연말 재생 통계와 연말 플레이리스트"
    version="v0.8.1"
    :icon="BarChart3"
    :points="[
      '한 해 동안 가장 많이 재생된 트랙 TOP 10',
      '월별 재생 시간 추이와 참여 멤버 집계',
      '연말 플레이리스트를 자동으로 만들어 채널에 공유',
      'DB 연동(v0.8.0) 이후 집계 데이터를 사용합니다',
    ]"
  />
</template>
