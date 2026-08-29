<script setup lang="ts">
  import PageHeader from '@/components/common/page-header.vue';
  import JobsTable from '@/components/music/jobs-table.vue';
  import PlaybackPanel from '@/components/music/playback-panel.vue';
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader title="음악" description="보이스 채널 재생 제어와 워커 작업 현황" />
    <PlaybackPanel />
    <JobsTable />
  </div>
</template>
