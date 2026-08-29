<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue';

  import { fetchJson } from '@/api';
  import StateBlock from '@/components/common/state-block.vue';
  import { Badge } from '@/components/ui/badge';
  import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import type { JobRecord, JobsResponse, JobStatus } from '@/types';

  const jobs = ref<JobRecord[]>([]);
  const error = ref('');
  const loading = ref(true);
  let timer: ReturnType<typeof setInterval> | undefined;

  const statusVariant: Record<JobStatus, 'default' | 'secondary' | 'destructive'> = {
    pending: 'secondary',
    ready: 'default',
    failed: 'destructive',
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
      error.value = cause instanceof Error ? cause.message : '작업 목록을 불러오지 못했습니다.';
    } finally {
      loading.value = false;
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
  <Card>
    <CardHeader>
      <CardTitle class="text-base">음악 작업</CardTitle>
      <CardAction>
        <Badge variant="outline" class="tnum">{{ jobs.length }}</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <StateBlock
        :loading="loading"
        :error="error"
        :empty="jobs.length === 0"
        empty-text="아직 처리한 작업이 없습니다."
      >
        <!-- Table on wide screens, cards on narrow ones — a 4-column table cannot
             shrink to a phone without a scrollbar swallowing the last column. -->
        <div class="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-24">상태</TableHead>
                <TableHead>요청</TableHead>
                <TableHead>제목</TableHead>
                <TableHead class="w-44">갱신</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="job in jobs" :key="job.jobId">
                <TableCell>
                  <Badge :variant="statusVariant[job.status]">{{ job.status }}</Badge>
                </TableCell>
                <TableCell class="max-w-56 truncate">{{ job.query }}</TableCell>
                <TableCell class="max-w-56 truncate">
                  {{ job.track?.title ?? job.error ?? '—' }}
                </TableCell>
                <TableCell class="text-muted-foreground tnum text-xs">
                  {{ formatTime(job.updatedAt) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <ul class="flex list-none flex-col gap-2 p-0 md:hidden">
          <li v-for="job in jobs" :key="job.jobId" class="bg-muted/40 rounded-lg border p-3">
            <div class="mb-1.5 flex items-center justify-between gap-2">
              <Badge :variant="statusVariant[job.status]">{{ job.status }}</Badge>
              <span class="text-muted-foreground tnum text-xs">
                {{ formatTime(job.updatedAt) }}
              </span>
            </div>
            <p class="truncate text-sm">{{ job.query }}</p>
            <p class="text-muted-foreground truncate text-xs">
              {{ job.track?.title ?? job.error ?? '—' }}
            </p>
          </li>
        </ul>
      </StateBlock>
    </CardContent>
  </Card>
</template>
