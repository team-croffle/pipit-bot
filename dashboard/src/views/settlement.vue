<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue';
  import { I18nT, useI18n } from 'vue-i18n';
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
  import { intlLocale } from '@/i18n';
  import {
    dueLabel,
    periodLabel,
    yearPlaylistName,
    type RecapPeriod,
    type RecapSummary,
  } from '@/lib/recap';
  import type { DashboardIdentity } from '@/types';

  /**
   * The music recaps: everyone's, by month or year, and one's own. Who asked for which
   * track is shown nowhere — the API never returns it.
   */
  const { t } = useI18n();
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
      name: period.open
        ? t('recap.periodOpen', { period: periodLabel(period) })
        : periodLabel(period),
    })),
  );
  const canPost = computed(() => me.canWriteSettings && current.value !== undefined);
  /** Why a running period cannot be posted, and when it will be. */
  const openHint = computed(() => {
    const period = current.value;
    if (!period?.open) {
      return '';
    }
    return t('recap.openHint', { period: periodLabel(period), due: dueLabel(period) });
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
      listError.value = cause instanceof Error ? cause.message : t('recap.listFailed');
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
      recapError.value = cause instanceof Error ? cause.message : t('recap.loadFailed');
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
      mineError.value = cause instanceof Error ? cause.message : t('recap.mineFailed');
    }
  }

  async function repost(): Promise<void> {
    posting.value = true;
    postNotice.value = '';
    try {
      await postJson(`/api/music/recaps/${selected.value}/post`);
      postNotice.value = t('recap.posted');
      confirming.value = false;
      await Promise.all([loadPeriods(), loadRecap(selected.value)]);
    } catch (cause) {
      postNotice.value = cause instanceof Error ? cause.message : t('recap.postFailed');
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
    <PageHeader :title="t('recap.title')" :description="t('recap.description')" />

    <StateBlock
      :loading="!periods && !listError"
      :error="listError"
      :empty="periods?.length === 0"
      :empty-text="t('recap.noHistory')"
    >
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full sm:w-56">
          <OptionSelect
            v-model="selected"
            :options="options"
            :placeholder="t('recap.choosePeriod')"
            id="recap-period"
          />
        </div>
        <Badge v-if="current?.open" variant="secondary">{{ t('recap.openBadge') }}</Badge>
        <Badge v-else-if="postedAt" variant="secondary" data-recap-posted>
          {{ t('recap.postedAt', { at: new Date(postedAt).toLocaleString(intlLocale()) }) }}
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
          {{ t('recap.repost') }}
        </Button>
      </div>
      <p v-if="canPost && openHint" class="text-muted-foreground text-xs" data-recap-open-hint>
        {{ openHint }}
      </p>
      <p v-if="postNotice" class="text-muted-foreground text-xs" role="status">{{ postNotice }}</p>

      <Tabs v-model="tab" class="gap-5">
        <TabsList>
          <TabsTrigger value="all" data-tab="all">{{ t('recap.tabAll') }}</TabsTrigger>
          <TabsTrigger value="mine" data-tab="mine">{{ t('recap.tabMine') }}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" class="flex flex-col gap-5">
          <StateBlock
            :loading="!recap && !recapError"
            :error="recapError"
            :empty="recap?.plays === 0"
            :empty-text="t('recap.noPlays')"
          >
            <p
              v-if="recap?.kind === 'year' && playlistExists"
              class="bg-muted rounded-xl border px-4 py-3 text-sm"
              data-recap-playlist
            >
              <I18nT keypath="recap.yearPlaylist" scope="global">
                <template #name>
                  <RouterLink to="/music" class="font-medium underline underline-offset-2">
                    {{ yearPlaylistName(recap.period) }}
                  </RouterLink>
                </template>
              </I18nT>
            </p>
            <RecapSummaryView v-if="recap" :summary="recap" />
          </StateBlock>
        </TabsContent>

        <TabsContent value="mine" class="flex flex-col gap-5">
          <p v-if="!me.discordUserId" class="text-muted-foreground text-sm" data-recap-not-linked>
            <I18nT keypath="recap.notLinked" scope="global">
              <template #link>
                <RouterLink to="/github" class="underline underline-offset-2">
                  {{ t('recap.githubPage') }}
                </RouterLink>
              </template>
            </I18nT>
          </p>
          <StateBlock
            v-else
            :loading="!mine && !mineError"
            :error="mineError"
            :empty="mine?.plays === 0"
            :empty-text="t('recap.noMine')"
          >
            <RecapSummaryView v-if="mine" :summary="mine" personal />
          </StateBlock>
        </TabsContent>
      </Tabs>
    </StateBlock>

    <Dialog v-model:open="confirming">
      <DialogContent class="sm:max-w-md" data-recap-repost-dialog>
        <DialogHeader>
          <DialogTitle>{{ t('recap.repostTitle') }}</DialogTitle>
          <DialogDescription>
            {{ t('recap.repostBody', { period: current ? periodLabel(current) : '' }) }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="posting" @click="confirming = false">
            {{ t('recap.cancel') }}
          </Button>
          <Button :disabled="posting" data-recap-repost-confirm @click="repost">
            {{ t('recap.post') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
