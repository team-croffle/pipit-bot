<script setup lang="ts">
  import { Clock, Disc3, ListMusic, Repeat, Users } from 'lucide-vue-next';
  import { computed } from 'vue';

  import StatCard from '@/components/common/stat-card.vue';
  import RecapBars from '@/components/recap/recap-bars.vue';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { formatPlayed, WEEKDAYS, type RecapSummary } from '@/lib/recap';

  /**
   * One recap, everyone's or one's own. It names tracks and counts people — never who
   * asked for which track; the summary carries no person to show.
   */
  const { summary, personal = false } = defineProps<{
    summary: RecapSummary;
    personal?: boolean;
  }>();

  const most = computed(() => Math.max(1, ...summary.topTracks.map((track) => track.listens)));
  const hours = Array.from({ length: 24 }, (_, hour) => `${hour}시`);
  const months = Array.from({ length: 12 }, (_, month) => `${month + 1}월`);
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-recap-stats>
      <StatCard label="재생 시간" :value="formatPlayed(summary.playedSec)" :icon="Clock" />
      <StatCard
        label="재생"
        :value="`${summary.plays}회`"
        :hint="`끝까지·절반 이상 ${summary.listens}회`"
        :icon="Repeat"
      />
      <StatCard label="곡" :value="`${summary.tracks}곡`" :icon="Disc3" />
      <StatCard
        v-if="!personal"
        label="참여 인원"
        :value="`${summary.participants ?? 0}명`"
        :hint="`자동 재생 ${Math.round(summary.autoplayShare * 100)}%`"
        :icon="Users"
      />
      <StatCard
        v-else
        label="자동 재생"
        :value="`${Math.round(summary.autoplayShare * 100)}%`"
        :icon="ListMusic"
      />
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <Card class="min-w-0" data-recap-top>
        <CardHeader>
          <CardTitle class="text-base">많이 들은 곡</CardTitle>
          <CardDescription>끝까지, 또는 절반 이상 들은 횟수</CardDescription>
        </CardHeader>
        <CardContent>
          <p v-if="summary.topTracks.length === 0" class="text-muted-foreground text-sm">
            아직 끝까지 들은 곡이 없습니다.
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
                  {{ track.listens }}회 · {{ formatPlayed(track.playedSec) }}
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
            <CardTitle class="text-base">요일별</CardTitle>
          </CardHeader>
          <CardContent>
            <RecapBars :labels="WEEKDAYS" :values="summary.byWeekday" label="요일별 재생" />
          </CardContent>
        </Card>
        <Card class="min-w-0">
          <CardHeader>
            <CardTitle class="text-base">시간대별</CardTitle>
            <CardDescription>{{ summary.timeZone }} 기준</CardDescription>
          </CardHeader>
          <CardContent>
            <RecapBars :labels="hours" :values="summary.byHour" label="시간대별 재생" :every="3" />
          </CardContent>
        </Card>
      </div>
    </div>

    <Card v-if="summary.months" class="min-w-0" data-recap-months>
      <CardHeader>
        <CardTitle class="text-base">월별 재생</CardTitle>
      </CardHeader>
      <CardContent>
        <RecapBars
          :labels="months"
          :values="summary.months.map((month) => month.plays)"
          label="월별 재생"
        />
      </CardContent>
    </Card>
  </div>
</template>
