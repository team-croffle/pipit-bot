<script setup lang="ts">
  import { Activity, Github, ListMusic, Radio } from 'lucide-vue-next';
  import { computed, onMounted, ref } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { RouterLink } from 'vue-router';

  import { fetchJson } from '@/api';
  import PageHeader from '@/components/common/page-header.vue';
  import StatCard from '@/components/common/stat-card.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { intlLocale } from '@/i18n';
  import type {
    DashboardIdentity,
    GithubDelivery,
    GithubNotifySettings,
    JobsResponse,
    PlaybackState,
  } from '@/types';

  const { t } = useI18n();
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
      return t('overview.idle');
    }

    return state.paused ? t('overview.paused') : t('overview.playing');
  });

  const playbackHint = computed(() => {
    const state = playback.value;
    if (!state?.active) {
      return t('overview.nothingPlaying');
    }

    return state.current?.title ?? state.voiceChannelName ?? t('overview.voiceConnected');
  });

  const githubLabel = computed(() => {
    if (!github.value) {
      return t('overview.unknown');
    }

    return github.value.enabled ? t('overview.enabled') : t('overview.disabled');
  });

  const githubHint = computed(() => {
    const settings = github.value;
    if (!settings) {
      return '';
    }
    if (!settings.channelId) {
      return t('overview.noChannel');
    }

    const repoCount = settings.repos.length;
    return repoCount > 0
      ? t('overview.repoOverrides', { count: repoCount }, repoCount)
      : t('overview.defaults');
  });

  const features = computed<{ label: string; on: boolean; to: string; planned?: string }[]>(() => [
    { label: t('overview.featureMusic'), on: true, to: '/music' },
    { label: t('overview.featureGithub'), on: github.value?.enabled ?? false, to: '/github' },
    { label: t('overview.featureInvites'), on: true, to: '/invites' },
    { label: t('overview.featureReactionRoles'), on: true, to: '/reaction-roles' },
    { label: t('overview.featureAudit'), on: true, to: '/logs' },
    { label: t('overview.featureRecap'), on: true, to: '/settlement' },
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
    return new Date(at).toLocaleString(intlLocale());
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
      error.value = t('overview.loadFailed');
    }

    loading.value = false;
  });
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader :title="t('overview.title')" :description="t('overview.description')" />

    <p
      v-if="!me.canWriteSettings"
      class="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm"
    >
      {{ t('overview.readOnly') }}
    </p>

    <StateBlock :loading="loading" :error="error">
      <div class="flex flex-col gap-5">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            :label="t('overview.playback')"
            :value="playbackLabel"
            :hint="playbackHint"
            :icon="Radio"
          />
          <StatCard
            :label="t('overview.queue')"
            :value="
              t(
                'overview.trackCount',
                { count: playback?.pendingCount ?? 0 },
                playback?.pendingCount ?? 0,
              )
            "
            :hint="playback?.durationFormatted ?? t('overview.queueEmpty')"
            :icon="ListMusic"
          />
          <StatCard
            :label="t('overview.jobs')"
            :value="t('overview.jobCount', { count: jobCount }, jobCount)"
            :hint="t('overview.jobsHint')"
            :icon="Activity"
          />
          <StatCard
            :label="t('overview.githubReminders')"
            :value="githubLabel"
            :hint="githubHint"
            :icon="Github"
          />
        </div>

        <div class="grid gap-4 lg:grid-cols-5">
          <Card class="lg:col-span-3">
            <CardHeader>
              <CardTitle class="text-base">{{ t('overview.recentDeliveries') }}</CardTitle>
              <CardAction>
                <Button as-child variant="outline" size="sm">
                  <RouterLink to="/github">{{ t('overview.openSettings') }}</RouterLink>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <StateBlock :empty="deliveries.length === 0" :empty-text="t('overview.noDeliveries')">
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
                      <code class="text-muted-foreground truncate font-gothic text-xs">
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
              <CardTitle class="text-base">{{ t('overview.featureStatus') }}</CardTitle>
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
                      {{ feature.on ? t('overview.on') : t('overview.off') }}
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
