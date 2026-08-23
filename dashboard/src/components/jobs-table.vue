<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue';

  import { fetchJson } from '../api';
  import type { JobRecord, JobsResponse, JobStatus } from '../types';

  const jobs = ref<JobRecord[]>([]);
  const error = ref('');
  let timer: ReturnType<typeof setInterval> | undefined;

  const jobStatusClasses: Record<JobStatus, string> = {
    pending: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
    ready: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
    failed: 'border-red-500/30 bg-red-500/15 text-red-400',
  };

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
  <section
    class="rounded-2xl border border-line-soft bg-panel p-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)] sm:p-5"
  >
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="m-0 text-base font-semibold">Music jobs</h2>
      <span
        class="rounded-full border border-line bg-bg-elevated px-2.5 py-1 text-xs font-medium text-muted"
      >
        {{ jobs.length }}
      </span>
    </div>
    <p v-if="error" class="text-sm text-bad">{{ error }}</p>
    <p v-else-if="jobs.length === 0" class="text-sm text-muted">No jobs yet.</p>
    <template v-else>
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full min-w-160 border-collapse text-sm">
          <thead>
            <tr
              class="border-b border-line-soft text-left text-xs uppercase tracking-wide text-muted"
            >
              <th class="pb-2 pr-3 font-medium">Status</th>
              <th class="pb-2 pr-3 font-medium">Query</th>
              <th class="pb-2 pr-3 font-medium">Title</th>
              <th class="pb-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in jobs" :key="job.jobId" class="border-b border-line-soft/60">
              <td class="py-2.5 pr-3">
                <span
                  class="rounded-full border px-2 py-0.5 text-xs font-medium uppercase"
                  :class="jobStatusClasses[job.status]"
                >
                  {{ job.status }}
                </span>
              </td>
              <td class="max-w-50 truncate py-2.5 pr-3">{{ job.query }}</td>
              <td class="max-w-50 truncate py-2.5 pr-3">
                {{ job.track?.title ?? job.error ?? '—' }}
              </td>
              <td class="py-2.5 text-xs text-muted">{{ formatTime(job.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul class="m-0 list-none space-y-3 p-0 md:hidden">
        <li
          v-for="job in jobs"
          :key="job.jobId"
          class="rounded-xl border border-line-soft bg-bg-elevated p-3"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <span
              class="rounded-full border px-2 py-0.5 text-xs font-medium uppercase"
              :class="jobStatusClasses[job.status]"
            >
              {{ job.status }}
            </span>
            <span class="text-xs text-muted">{{ formatTime(job.updatedAt) }}</span>
          </div>
          <p class="mb-1 truncate text-sm">{{ job.query }}</p>
          <p class="truncate text-xs text-muted">{{ job.track?.title ?? job.error ?? '—' }}</p>
        </li>
      </ul>
    </template>
  </section>
</template>
