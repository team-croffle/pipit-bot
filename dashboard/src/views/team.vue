<script setup lang="ts">
  import { Users } from 'lucide-vue-next';

  import PlannedView from '@/components/common/planned-view.vue';
</script>

<template>
  <PlannedView
    title="팀 관리"
    description="리액션 롤 고도화와 팀 온보딩 흐름"
    version="v0.6.7"
    :icon="Users"
    :points="[
      '역할 선택 메시지를 채널에 게시하고 봇이 직접 관리',
      '한 사람당 하나의 역할만 유지하도록 이전 반응을 자동 정리',
      '가입 후 규칙 동의 · 역할 선택 · 안내 DM으로 이어지는 온보딩',
      '초대 코드별 유입 추적 (현재는 설정 화면에서 채널만 지정)',
    ]"
  />
</template>
