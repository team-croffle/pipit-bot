<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue';

  import { fetchJson } from '../api';
  import type { DashboardIdentity, HealthResponse, JobRecord, JobsResponse } from '../types';

  const { me } = defineProps<{ me: DashboardIdentity }>();

  const health = ref('unknown');
  const jobs = ref<JobRecord[]>([]);
  const error = ref('');
  let timer: ReturnType<typeof setInterval> | undefined;

  function formatTime(epochMs: number): string {
    return new Date(epochMs).toLocaleString();
  }

  async function refresh(): Promise<void> {
    try {
      const [healthBody, jobsBody] = await Promise.all([
        fetchJson<HealthResponse>('/api/health'),
        fetchJson<JobsResponse>('/api/music/jobs'),
      ]);
      health.value = healthBody.status;
      jobs.value = jobsBody.jobs;
      error.value = '';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Failed to refresh';
    }
  }

  onMounted(async () => {
    await refresh();
    timer = setInterval(() => {
      void refresh();
    }, 5000);
  });

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer);
    }
  });
</script>

<template>
  <div class="grid">
    <p v-if="!me.canWriteSettings" class="banner">
      View only — settings and playback controls stay visible but cannot be changed.
    </p>
    <section class="card">
      <h2>Health</h2>
      <p class="health">
        <span class="dot" :class="health === 'ok' ? 'ok' : 'bad'"></span>
        pipit-api {{ health }}
      </p>
    </section>
    <section class="card">
      <h2>Playback</h2>
      <p class="empty">Queue and play requests will land here.</p>
      <div class="actions">
        <button class="ghost" type="button" :disabled="!me.canControlPlayback">Play</button>
        <button class="ghost" type="button" :disabled="!me.canControlPlayback">Skip</button>
      </div>
    </section>
    <section class="card">
      <h2>Music jobs</h2>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-else-if="jobs.length === 0" class="empty">No jobs yet.</p>
      <table v-else>
        <thead>
          <tr>
            <th>Status</th>
            <th>Query</th>
            <th>Title</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="job in jobs" :key="job.jobId">
            <td class="status" :class="job.status">{{ job.status }}</td>
            <td>{{ job.query }}</td>
            <td>{{ job.track?.title ?? job.error ?? '—' }}</td>
            <td>{{ formatTime(job.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
