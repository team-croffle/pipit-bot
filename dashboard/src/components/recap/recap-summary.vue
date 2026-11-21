<script setup lang="ts">
  import { Clock, Disc3, ListMusic, Repeat, Users } from 'lucide-vue-next';
  import { computed } from 'vue';
  import { useI18n } from 'vue-i18n';

  import StatCard from '@/components/common/stat-card.vue';
  import RecapBars from '@/components/recap/recap-bars.vue';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { formatPlayed, hourLabels, monthLabels, weekdays, type RecapSummary } from '@/lib/recap';

  /**
   * One recap, everyone's or one's own. It names tracks and counts people — never who
   * asked for which track; the summary carries no person to show.
   */
  const { t } = useI18n();
  const { summary, personal = false } = defineProps<{
    summary: RecapSummary;
    personal?: boolean;
  }>();

  const most = computed(() => Math.max(1, ...summary.topTracks.map((track) => track.listens)));
  const hours = computed(hourLabels);
  const months = computed(monthLabels);
  const days = computed(weekdays);
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-recap-stats>
      <StatCard
        :label="t('recap.playedTime')"
        :value="formatPlayed(summary.playedSec)"
        :icon="Clock"
      />
      <StatCard
        :label="t('recap.plays')"
        :value="t('recap.times', { count: summary.plays }, summary.plays)"
        :hint="t('recap.listens', { count: summary.listens }, summary.listens)"
        :icon="Repeat"
      />
      <StatCard
        :label="t('recap.tracks')"
        :value="t('recap.trackCount', { count: summary.tracks }, summary.tracks)"
        :icon="Disc3"
      />
      <StatCard
        v-if="!personal"
        :label="t('recap.participants')"
        :value="t('recap.people', { count: summary.participants ?? 0 }, summary.participants ?? 0)"
        :hint="t('recap.autoplayShare', { percent: Math.round(summary.autoplayShare * 100) })"
        :icon="Users"
      />
      <StatCard
        v-else
        :label="t('recap.autoplay')"
        :value="`${Math.round(summary.autoplayShare * 100)}%`"
        :icon="ListMusic"
      />
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <Card class="min-w-0" data-recap-top>
        <CardHeader>
          <CardTitle class="text-base">{{ t('recap.topTracks') }}</CardTitle>
          <CardDescription>{{ t('recap.topTracksHint') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <p v-if="summary.topTracks.length === 0" class="text-muted-foreground text-sm">
            {{ t('recap.noTopTracks') }}
          </p>
          <ol v-else class="flex flex-col gap-3">
            <li
              v-for="(track, index) in summary.topTracks"
              :key="track.fileKey"
              class="flex min-w-0 flex-col gap-1"
            >
              <div class="flex min-w-0 items-baseline gap-2 text-sm">
                <span class="text-muted-foreground tnum w-5 shrink-0 text-right">
                  {{ index + 1 }}
                </span>
                <span class="min-w-0 flex-1 truncate font-medium" :title="track.title">
                  {{ track.title }}
                </span>
                <span class="text-muted-foreground tnum shrink-0 text-xs">
                  {{ t('recap.times', { count: track.listens }, track.listens) }} ·
                  {{ formatPlayed(track.playedSec) }}
                </span>
              </div>
              <div class="bg-muted ml-7 h-1.5 overflow-hidden rounded-full">
                <div
                  class="bg-primary h-full rounded-full"
                  :style="{ width: `${(track.listens / most) * 100}%` }"
                />
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>

      <div class="flex min-w-0 flex-col gap-5">
        <Card class="min-w-0">
          <CardHeader>
            <CardTitle class="text-base">{{ t('recap.byWeekday') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <RecapBars
              :labels="days"
              :values="summary.byWeekday"
              :label="t('recap.byWeekdayPlays')"
            />
          </CardContent>
        </Card>
        <Card class="min-w-0">
          <CardHeader>
            <CardTitle class="text-base">{{ t('recap.byHour') }}</CardTitle>
            <CardDescription>{{ t('recap.timeZone', { zone: summary.timeZone }) }}</CardDescription>
          </CardHeader>
          <CardContent>
            <RecapBars
              :labels="hours"
              :values="summary.byHour"
              :label="t('recap.byHourPlays')"
              :every="3"
            />
          </CardContent>
        </Card>
      </div>
    </div>

    <Card v-if="summary.months" class="min-w-0" data-recap-months>
      <CardHeader>
        <CardTitle class="text-base">{{ t('recap.byMonth') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <RecapBars
          :labels="months"
          :values="summary.months.map((month) => month.plays)"
          :label="t('recap.byMonth')"
        />
      </CardContent>
    </Card>
  </div>
</template>
