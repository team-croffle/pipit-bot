<script setup lang="ts">
  import PageHeader from '@/components/common/page-header.vue';
  import ChannelRestriction from '@/components/music/channel-restriction.vue';
  import JobsTable from '@/components/music/jobs-table.vue';
  import PlaybackPanel from '@/components/music/playback-panel.vue';
  import type { DashboardIdentity } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader title="음악" description="재생 제어, 워커 작업 현황, 명령 채널" />
    <PlaybackPanel />
    <JobsTable />
    <ChannelRestriction :read-only="!me.canWriteSettings" />
  </div>
</template>
