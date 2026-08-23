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
  <div class="flex flex-col gap-4">
    <p
      v-if="!me.canWriteSettings"
      class="rounded-xl border border-line-soft bg-readonly px-4 py-3 text-sm text-muted"
    >
      View only — settings cannot be changed.
    </p>

    <HealthBadge :status="health" />
    <PlaybackPanel />
    <JobsTable />
  </div>
</template>
