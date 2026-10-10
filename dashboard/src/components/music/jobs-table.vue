<script setup lang="ts">
  import { RotateCcw, X } from 'lucide-vue-next';
  import { onMounted, onUnmounted, ref } from 'vue';

  import { fetchJson, postJson } from '@/api';
  import StateBlock from '@/components/common/state-block.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import {
    canCancel,
    canRetry,
    JOB_STATUS_LABEL,
    JOB_STATUS_VARIANT,
    jobReason,
  } from '@/lib/music-jobs';
  import type { JobRecord, JobsResponse } from '@/types';

  const jobs = ref<JobRecord[]>([]);
  const error = ref('');
  const loading = ref(true);
  const actionMessage = ref('');
  const actionFailed = ref(false);
  const busyId = ref<string | null>(null);
  let timer: ReturnType<typeof setInterval> | undefined;

  function formatTime(epochMs: number): string {
    return new Date(epochMs).toLocaleString();
  }

  function isRedirect(cause: unknown): boolean {
    return cause instanceof Error && cause.message.startsWith('Redirecting to login');
  }

  async function refresh(): Promise<void> {
    try {
      const body = await fetchJson<JobsResponse>('/api/music/jobs');
      jobs.value = body.jobs;
      error.value = '';
    } catch (cause) {
      if (isRedirect(cause)) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '작업 목록을 불러오지 못했습니다.';
    } finally {
      loading.value = false;
    }
  }

  async function act(job: JobRecord, action: 'cancel' | 'retry'): Promise<void> {
    busyId.value = job.jobId;
    try {
      await postJson(`/api/music/jobs/${encodeURIComponent(job.jobId)}/${action}`);
      actionMessage.value =
        action === 'cancel'
          ? '작업을 취소했습니다. 나중에 준비가 끝나도 재생하지 않습니다.'
          : '같은 요청으로 다시 준비하고 있습니다.';
      actionFailed.value = false;
    } catch (cause) {
      if (isRedirect(cause)) {
        return;
      }
      actionMessage.value = cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.';
      actionFailed.value = true;
    } finally {
      busyId.value = null;
      await refresh();
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
  <Card data-jobs-card>
    <CardHeader>
      <CardTitle class="text-base">음악 작업</CardTitle>
      <CardAction>
        <Badge variant="outline" class="tnum">{{ jobs.length }}</Badge>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <p
        v-if="actionMessage"
        class="text-sm"
        :class="actionFailed ? 'text-destructive' : 'text-muted-foreground'"
        :role="actionFailed ? 'alert' : undefined"
        aria-live="polite"
      >
        {{ actionMessage }}
      </p>
      <StateBlock
        :loading="loading"
        :error="error"
        :empty="jobs.length === 0"
        empty-text="아직 처리한 작업이 없습니다."
      >
        <!-- Table on wide screens, cards on narrow ones — a 5-column table cannot
             shrink to a phone without a scrollbar swallowing the last column. -->
        <div class="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-24">상태</TableHead>
                <TableHead>요청</TableHead>
                <TableHead>결과</TableHead>
                <TableHead class="w-44">갱신</TableHead>
                <TableHead class="w-24 text-right"><span class="sr-only">작업</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="job in jobs"
                :key="job.jobId"
                data-job-row
                :data-job-id="job.jobId"
                :data-job-status="job.status"
              >
                <TableCell>
                  <Badge data-job-badge :variant="JOB_STATUS_VARIANT[job.status]">
                    {{ JOB_STATUS_LABEL[job.status] }}
                  </Badge>
                </TableCell>
                <TableCell class="max-w-56 truncate">{{ job.query }}</TableCell>
                <TableCell class="max-w-72">
                  <template v-if="jobReason(job)">
                    <div data-job-reason class="min-w-0">
                      <p class="truncate">{{ jobReason(job)?.summary }}</p>
                      <p
                        v-if="jobReason(job)?.detail"
                        class="text-muted-foreground truncate text-xs"
                      >
                        {{ jobReason(job)?.detail }}
                      </p>
                    </div>
                  </template>
                  <p v-else class="truncate">{{ job.track?.title ?? '—' }}</p>
                  <p v-if="job.lateResult" data-job-late class="text-muted-foreground text-xs">
                    응답이 늦게 도착함 — 재생하지 않음
                  </p>
                  <p v-if="job.retriedAs" data-job-retried class="text-muted-foreground text-xs">
                    다시 시도함
                  </p>
                </TableCell>
                <TableCell class="text-muted-foreground tnum text-xs">
                  {{ formatTime(job.updatedAt) }}
                </TableCell>
                <TableCell class="text-right">
                  <Button
                    v-if="canCancel(job)"
                    data-job-action="cancel"
                    variant="outline"
                    size="xs"
                    :disabled="busyId !== null"
                    @click="act(job, 'cancel')"
                  >
                    <X />
                    취소
                  </Button>
                  <Button
                    v-else-if="canRetry(job)"
                    data-job-action="retry"
                    variant="outline"
                    size="xs"
                    :disabled="busyId !== null"
                    @click="act(job, 'retry')"
                  >
                    <RotateCcw />
                    다시 시도
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <ul class="flex list-none flex-col gap-2 p-0 md:hidden">
          <li
            v-for="job in jobs"
            :key="job.jobId"
            data-job-row
            :data-job-id="job.jobId"
            :data-job-status="job.status"
            class="bg-muted/40 rounded-lg border p-3"
          >
            <div class="mb-1.5 flex items-center justify-between gap-2">
              <Badge data-job-badge :variant="JOB_STATUS_VARIANT[job.status]">
                {{ JOB_STATUS_LABEL[job.status] }}
              </Badge>
              <span class="text-muted-foreground tnum text-xs">
                {{ formatTime(job.updatedAt) }}
              </span>
            </div>
            <p class="truncate text-sm">{{ job.query }}</p>
            <div v-if="jobReason(job)" data-job-reason class="min-w-0">
              <p class="truncate text-xs">{{ jobReason(job)?.summary }}</p>
              <p v-if="jobReason(job)?.detail" class="text-muted-foreground truncate text-xs">
                {{ jobReason(job)?.detail }}
              </p>
            </div>
            <p v-else class="text-muted-foreground truncate text-xs">
              {{ job.track?.title ?? '—' }}
            </p>
            <p v-if="job.lateResult" data-job-late class="text-muted-foreground text-xs">
              응답이 늦게 도착함 — 재생하지 않음
            </p>
            <p v-if="job.retriedAs" data-job-retried class="text-muted-foreground text-xs">
              다시 시도함
            </p>
            <div v-if="canCancel(job) || canRetry(job)" class="mt-2 flex justify-end">
              <Button
                v-if="canCancel(job)"
                data-job-action="cancel"
                variant="outline"
                size="xs"
                :disabled="busyId !== null"
                @click="act(job, 'cancel')"
              >
                <X />
                취소
              </Button>
              <Button
                v-else
                data-job-action="retry"
                variant="outline"
                size="xs"
                :disabled="busyId !== null"
                @click="act(job, 'retry')"
              >
                <RotateCcw />
                다시 시도
              </Button>
            </div>
          </li>
        </ul>
      </StateBlock>
    </CardContent>
  </Card>
</template>
