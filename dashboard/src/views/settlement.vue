<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue';
  import { RouterLink } from 'vue-router';

  import { fetchJson, postJson } from '@/api';
  import OptionSelect from '@/components/common/option-select.vue';
  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import RecapSummaryView from '@/components/recap/recap-summary.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { periodLabel, yearPlaylistName, type RecapPeriod, type RecapSummary } from '@/lib/recap';
  import type { DashboardIdentity } from '@/types';

  /**
   * The music recaps: everyone's, by month or year, and one's own. Who asked for which
   * track is shown nowhere — the API never returns it.
   */
  const { me } = defineProps<{ me: DashboardIdentity }>();

  const periods = ref<RecapPeriod[] | null>(null);
  const listError = ref('');
  const selected = ref('');
  const tab = ref<'all' | 'mine'>('all');

  const recap = ref<RecapSummary | null>(null);
  const postedAt = ref<string | null>(null);
  const recapError = ref('');
  const mine = ref<RecapSummary | null>(null);
  const mineError = ref('');
  const playlistExists = ref(false);

  const confirming = ref(false);
  const posting = ref(false);
  const postNotice = ref('');

  const current = computed(() => periods.value?.find((period) => period.id === selected.value));
  const options = computed(() =>
    (periods.value ?? []).map((period) => ({
      id: period.id,
      name: `${periodLabel(period)}${period.open ? ' (진행 중)' : ''}`,
    })),
  );
  const canPost = computed(() => me.canWriteSettings && current.value !== undefined);
  /** Why a running period cannot be posted, and when it will be. */
  const openHint = computed(() => {
    const period = current.value;
    if (!period?.open) {
      return '';
    }
    const [year, month] = period.id.split('-').map(Number);
    const due =
      period.kind === 'year' || month === 12
        ? `${(year ?? 0) + 1}년 1월 1일`
        : `${month! + 1}월 1일`;
    return `끝난 기간만 게시할 수 있습니다 — ${periodLabel(period)} 결산은 ${due}에 게시됩니다.`;
  });

  async function loadPeriods(): Promise<void> {
    try {
      const body = await fetchJson<{ periods: RecapPeriod[] }>('/api/music/recaps');
      periods.value = body.periods;
      listError.value = '';
      // The month just ended reads best first; the running one when there is none.
      selected.value ||=
        body.periods.find((period) => period.kind === 'month' && !period.open)?.id ??
        body.periods.find((period) => period.kind === 'month')?.id ??
        '';
    } catch (cause) {
      listError.value = cause instanceof Error ? cause.message : '결산 목록을 불러오지 못했습니다.';
    }
  }

  async function loadRecap(id: string): Promise<void> {
    recap.value = null;
    recapError.value = '';
    try {
      const body = await fetchJson<{ recap: RecapSummary; postedAt: string | null }>(
        `/api/music/recaps/${id}`,
      );
      if (selected.value !== id) {
        return;
      }
      recap.value = body.recap;
      postedAt.value = body.postedAt;
      if (body.recap.kind === 'year') {
        const lists = await fetchJson<{ playlists: { name: string }[] }>('/api/playlists').catch(
          () => ({ playlists: [] }),
        );
        playlistExists.value = lists.playlists.some(
          (playlist) => playlist.name === yearPlaylistName(body.recap.period),
        );
      } else {
        playlistExists.value = false;
      }
    } catch (cause) {
      recapError.value = cause instanceof Error ? cause.message : '결산을 불러오지 못했습니다.';
    }
  }

  async function loadMine(id: string): Promise<void> {
    mine.value = null;
    mineError.value = '';
    if (!me.discordUserId) {
      return;
    }
    try {
      const body = await fetchJson<{ recap: RecapSummary }>(`/api/music/recaps/${id}/me`);
      if (selected.value === id) {
        mine.value = body.recap;
      }
    } catch (cause) {
      mineError.value = cause instanceof Error ? cause.message : '내 결산을 불러오지 못했습니다.';
    }
  }

  async function repost(): Promise<void> {
    posting.value = true;
    postNotice.value = '';
    try {
      await postJson(`/api/music/recaps/${selected.value}/post`);
      postNotice.value = '디스코드에 게시했습니다.';
      confirming.value = false;
      await Promise.all([loadPeriods(), loadRecap(selected.value)]);
    } catch (cause) {
      postNotice.value = cause instanceof Error ? cause.message : '게시하지 못했습니다.';
    } finally {
      posting.value = false;
    }
  }

  watch(selected, (id) => {
    postNotice.value = '';
    if (id) {
      void loadRecap(id);
      void loadMine(id);
    }
  });

  onMounted(loadPeriods);
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader
      title="음악 결산"
      description="월말·연말 재생 통계. 누가 어떤 곡을 신청했는지는 보이지 않습니다."
    />

    <StateBlock
      :loading="!periods && !listError"
      :error="listError"
      :empty="periods?.length === 0"
      empty-text="아직 결산할 재생 기록이 없습니다."
    >
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full sm:w-56">
          <OptionSelect
            v-model="selected"
            :options="options"
            placeholder="기간 선택"
            id="recap-period"
          />
        </div>
        <Badge v-if="current?.open" variant="secondary">진행 중 — 지금까지의 집계</Badge>
        <Badge v-else-if="postedAt" variant="secondary" data-recap-posted>
          {{ new Date(postedAt).toLocaleString('ko-KR') }} 게시됨
        </Badge>
        <Button
          v-if="canPost"
          variant="outline"
          size="sm"
          class="sm:ml-auto"
          data-recap-repost
          :disabled="current?.open"
          @click="confirming = true"
        >
          디스코드에 다시 게시
        </Button>
      </div>
      <p v-if="canPost && openHint" class="text-muted-foreground text-xs" data-recap-open-hint>
        {{ openHint }}
      </p>
      <p v-if="postNotice" class="text-muted-foreground text-xs" role="status">{{ postNotice }}</p>

      <Tabs v-model="tab" class="gap-5">
        <TabsList>
          <TabsTrigger value="all" data-tab="all">결산</TabsTrigger>
          <TabsTrigger value="mine" data-tab="mine">내 결산</TabsTrigger>
        </TabsList>

        <TabsContent value="all" class="flex flex-col gap-5">
          <StateBlock
            :loading="!recap && !recapError"
            :error="recapError"
            :empty="recap?.plays === 0"
            empty-text="이 기간에는 재생 기록이 없습니다."
          >
            <p
              v-if="recap?.kind === 'year' && playlistExists"
              class="bg-muted rounded-xl border px-4 py-3 text-sm"
              data-recap-playlist
            >
              이 해의 많이 들은 곡은 공유 재생목록
              <RouterLink to="/music" class="font-medium underline underline-offset-2">
                {{ yearPlaylistName(recap.period) }}
              </RouterLink>
              에 담겨 있습니다.
            </p>
            <RecapSummaryView v-if="recap" :summary="recap" />
          </StateBlock>
        </TabsContent>

        <TabsContent value="mine" class="flex flex-col gap-5">
          <p v-if="!me.discordUserId" class="text-muted-foreground text-sm" data-recap-not-linked>
            내 결산을 보려면 디스코드 계정이 연결되어 있어야 합니다.
            <RouterLink to="/github" class="underline underline-offset-2">GitHub 페이지</RouterLink>
            의 계정 연결에서 연결할 수 있습니다.
          </p>
          <StateBlock
            v-else
            :loading="!mine && !mineError"
            :error="mineError"
            :empty="mine?.plays === 0"
            empty-text="이 기간에 내가 신청한 곡이 없습니다."
          >
            <RecapSummaryView v-if="mine" :summary="mine" personal />
          </StateBlock>
        </TabsContent>
      </Tabs>
    </StateBlock>

    <Dialog v-model:open="confirming">
      <DialogContent class="sm:max-w-md" data-recap-repost-dialog>
        <DialogHeader>
          <DialogTitle>결산 다시 게시</DialogTitle>
          <DialogDescription>
            {{ current ? periodLabel(current) : '' }} 결산을 결산 채널에 새 메시지로 올립니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="posting" @click="confirming = false">취소</Button>
          <Button :disabled="posting" data-recap-repost-confirm @click="repost">게시</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
