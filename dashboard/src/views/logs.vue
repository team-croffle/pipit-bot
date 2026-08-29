<script setup lang="ts">
  import { ScrollText } from 'lucide-vue-next';

  import PlannedView from '@/components/common/planned-view.vue';
</script>

<template>
  <PlannedView
    title="로깅"
    description="대시보드 조작·음악 재생·알림 발송에 대한 감사 로그"
    version="v0.7.2"
    :icon="ScrollText"
    :points="[
      '대시보드 조작, 음악 기능, GitHub 알림, 초대·역할 이벤트 기록',
      '카테고리와 기간으로 필터링',
      '음악 기록은 곡 제목만 남기고 요청 원문은 저장하지 않습니다',
      '초기에는 파일로 저장하고 v0.8.0에서 DB로 옮깁니다',
    ]"
  />
</template>
