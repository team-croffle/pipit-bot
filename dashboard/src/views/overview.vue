<script setup lang="ts">
  import { onMounted, ref } from 'vue';

  import { fetchJson } from '../api';
  import HealthBadge from '../components/health-badge.vue';
  import JobsTable from '../components/jobs-table.vue';
  import PlaybackPanel from '../components/playback-panel.vue';
  import type { DashboardIdentity, HealthResponse } from '../types';

  const { me } = defineProps<{ me: DashboardIdentity }>();

  const health = ref('unknown');

  onMounted(async () => {
    try {
      const body = await fetchJson<HealthResponse>('/api/health');
      health.value = body.status;
    } catch {
      health.value = 'error';
    }
  });
</script>

<template>
  <div class="overview">
    <p v-if="!me.canWriteSettings" class="banner">View only — settings cannot be changed.</p>

    <div class="overview-grid">
      <div class="overview-main">
        <PlaybackPanel />
      </div>
      <div class="overview-side">
        <HealthBadge :status="health" />
        <JobsTable />
      </div>
    </div>
  </div>
</template>
