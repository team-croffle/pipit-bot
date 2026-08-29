<script setup lang="ts">
  import { Activity, Github, ListMusic, Radio } from 'lucide-vue-next';
  import { computed, onMounted, ref } from 'vue';
  import { RouterLink } from 'vue-router';

  import { fetchJson } from '@/api';
  import PageHeader from '@/components/common/page-header.vue';
  import StatCard from '@/components/common/stat-card.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import type {
    DashboardIdentity,
    GithubDelivery,
    GithubNotifySettings,
    JobsResponse,
    PlaybackState,
  } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();

  const playback = ref<PlaybackState | null>(null);
  const github = ref<GithubNotifySettings | null>(null);
  const deliveries = ref<GithubDelivery[]>([]);
  const jobCount = ref(0);
  const loading = ref(true);
  const error = ref('');

  const playbackLabel = computed(() => {
    const state = playback.value;
    if (!state?.active) {
      return '대기 중';
    }

    return state.paused ? '일시정지' : '재생 중';
  });

  const playbackHint = computed(() => {
    const state = playback.value;
    if (!state?.active) {
      return '재생 중인 트랙이 없습니다';
    }

    return state.current?.title ?? state.voiceChannelName ?? '보이스 채널 연결됨';
  });

  const githubLabel = computed(() => {
    if (!github.value) {
      return '알 수 없음';
    }

    return github.value.enabled ? '활성' : '비활성';
  });

  const githubHint = computed(() => {
    const settings = github.value;
    if (!settings) {
      return '';
    }
    if (!settings.channelId) {
      return '알림 채널이 지정되지 않았습니다';
    }

    const repoCount = settings.repos.length;
    return repoCount > 0 ? `저장소 ${repoCount}곳 개별 설정` : '기본 설정 사용';
  });

  const features = computed(() => [
    { label: '음악 오케스트레이션', on: true, to: '/music' },
    { label: 'GitHub PR 리마인더', on: github.value?.enabled ?? false, to: '/github' },
    { label: '초대 로거', on: true, to: '/invites' },
    { label: '리액션 롤', on: true, to: '/reaction-roles' },
    { label: '감사 로깅', on: false, to: '/logs', planned: 'v0.7.2' },
    { label: '음악 결산', on: false, to: '/settlement', planned: 'v0.8.1' },
  ]);

  function outcomeVariant(
    outcome: GithubDelivery['outcome'],
  ): 'default' | 'secondary' | 'destructive' {
    if (outcome === 'sent') {
      return 'default';
    }

    return outcome === 'failed' ? 'destructive' : 'secondary';
  }

  function formatTime(at: string): string {
    return new Date(at).toLocaleString();
  }

  onMounted(async () => {
    // Each panel is independent, so one failing endpoint should not blank the page.
    const [playbackResult, jobsResult, githubResult, deliveryResult] = await Promise.allSettled([
      fetchJson<PlaybackState>('/api/music/playback'),
      fetchJson<JobsResponse>('/api/music/jobs'),
      fetchJson<GithubNotifySettings>('/api/github-notify'),
      fetchJson<{ deliveries: GithubDelivery[] }>('/api/github-notify/deliveries'),
    ]);

    if (playbackResult.status === 'fulfilled') {
      playback.value = playbackResult.value;
    }
    if (jobsResult.status === 'fulfilled') {
      jobCount.value = jobsResult.value.jobs.length;
    }
    if (githubResult.status === 'fulfilled') {
      github.value = githubResult.value;
    }
    if (deliveryResult.status === 'fulfilled') {
      deliveries.value = deliveryResult.value.deliveries;
    }

    if (playbackResult.status === 'rejected' && githubResult.status === 'rejected') {
      error.value = '대시보드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }

    loading.value = false;
  });
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader title="개요" description="봇 상태와 최근 활동을 한눈에" />

    <p
      v-if="!me.canWriteSettings"
      class="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm"
    >
      읽기 전용 계정입니다 — 설정을 변경할 수 없습니다.
    </p>

    <StateBlock :loading="loading" :error="error">
      <div class="flex flex-col gap-5">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="재생 상태" :value="playbackLabel" :hint="playbackHint" :icon="Radio" />
          <StatCard
            label="대기열"
            :value="`${playback?.pendingCount ?? 0}곡`"
            :hint="playback?.durationFormatted ?? '대기 중인 트랙 없음'"
            :icon="ListMusic"
          />
          <StatCard
            label="음악 작업"
            :value="`${jobCount}건`"
            hint="최근 워커 작업"
            :icon="Activity"
          />
          <StatCard
            label="GitHub 리마인더"
            :value="githubLabel"
            :hint="githubHint"
            :icon="Github"
          />
        </div>

        <div class="grid gap-4 lg:grid-cols-5">
          <Card class="lg:col-span-3">
            <CardHeader>
              <CardTitle class="text-base">최근 GitHub 발송</CardTitle>
              <CardAction>
                <Button as-child variant="outline" size="sm">
                  <RouterLink to="/github">설정 열기</RouterLink>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <StateBlock
                :empty="deliveries.length === 0"
                empty-text="봇이 시작된 뒤 도착한 이벤트가 아직 없습니다."
              >
                <ul class="flex list-none flex-col gap-2 p-0">
                  <li
                    v-for="(delivery, index) in deliveries.slice(0, 6)"
                    :key="`${delivery.at}-${index}`"
                    class="bg-muted/40 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <Badge :variant="outcomeVariant(delivery.outcome)" class="shrink-0">
                        {{ delivery.outcome }}
                      </Badge>
                      <span class="truncate">{{ delivery.event }}</span>
                      <code class="text-muted-foreground truncate font-mono text-xs">
                        {{ delivery.repo }}
                      </code>
                      <span class="text-muted-foreground ml-auto shrink-0 text-xs">
                        {{ formatTime(delivery.at) }}
                      </span>
                    </div>
                    <p v-if="delivery.detail" class="text-muted-foreground mt-1 text-xs">
                      {{ delivery.detail }}
                    </p>
                  </li>
                </ul>
              </StateBlock>
            </CardContent>
          </Card>

          <Card class="lg:col-span-2">
            <CardHeader>
              <CardTitle class="text-base">기능 상태</CardTitle>
            </CardHeader>
            <CardContent>
              <ul class="flex list-none flex-col gap-1 p-0">
                <li v-for="feature in features" :key="feature.label">
                  <RouterLink
                    :to="feature.to"
                    class="hover:bg-muted focus-visible:ring-ring/50 -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span
                      class="size-1.5 shrink-0 rounded-full"
                      :class="feature.on ? 'bg-success' : 'bg-muted-foreground/40'"
                      aria-hidden="true"
                    />
                    <span class="truncate">{{ feature.label }}</span>
                    <Badge
                      v-if="feature.planned"
                      variant="outline"
                      class="ml-auto shrink-0 px-1.5 py-0 text-[0.65rem]"
                    >
                      {{ feature.planned }}
                    </Badge>
                    <span v-else class="text-muted-foreground ml-auto shrink-0 text-xs">
                      {{ feature.on ? '켜짐' : '꺼짐' }}
                    </span>
                  </RouterLink>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </StateBlock>
  </div>
</template>
