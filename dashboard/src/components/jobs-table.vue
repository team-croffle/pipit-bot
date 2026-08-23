<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue';

  import { fetchJson } from '../api';
  import type { JobRecord, JobsResponse } from '../types';

  const jobs = ref<JobRecord[]>([]);
  const error = ref('');
  let timer: ReturnType<typeof setInterval> | undefined;

  function formatTime(epochMs: number): string {
    return new Date(epochMs).toLocaleString();
  }

  async function refresh(): Promise<void> {
    try {
      const body = await fetchJson<JobsResponse>('/api/music/jobs');
      jobs.value = body.jobs;
      error.value = '';
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : 'Failed to load jobs';
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

  defineExpose({ refresh });
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h2>Music jobs</h2>
      <span class="pill">{{ jobs.length }}</span>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="jobs.length === 0" class="empty">No jobs yet.</p>
    <template v-else>
      <div class="jobs-table-wrap">
        <table class="jobs-table">
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
              <td>
                <span class="status-pill" :class="job.status">{{ job.status }}</span>
              </td>
              <td class="truncate">{{ job.query }}</td>
              <td class="truncate">{{ job.track?.title ?? job.error ?? '—' }}</td>
              <td class="muted">{{ formatTime(job.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul class="jobs-cards">
        <li v-for="job in jobs" :key="job.jobId" class="job-card">
          <div class="job-card-top">
            <span class="status-pill" :class="job.status">{{ job.status }}</span>
            <span class="muted">{{ formatTime(job.updatedAt) }}</span>
          </div>
          <p class="job-query">{{ job.query }}</p>
          <p class="job-title">{{ job.track?.title ?? job.error ?? '—' }}</p>
        </li>
      </ul>
    </template>
  </section>
</template>
