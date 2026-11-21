<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { I18nT, useI18n } from 'vue-i18n';
  import { RouterLink } from 'vue-router';

  import { fetchJson, putJson } from '@/api';
  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import RecapSettingsCard from '@/components/music/recap-settings-card.vue';
  import LanguageCard from '@/components/settings/language-card.vue';
  import SignInMethodsCard from '@/components/settings/sign-in-methods-card.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import { Switch } from '@/components/ui/switch';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import { FEATURE_LIST, useFeatures, type Feature } from '@/composables/use-features';
  import type { DashboardIdentity } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;
  const { t } = useI18n();

  const { states, loadError, set, load } = useFeatures();
  const busy = ref<Feature | null>(null);
  const failure = ref('');

  /** Not built yet — shown so the list reads as the whole plan. */
  const planned = computed(() => [
    { key: 'calendar', label: t('settings.plannedCalendar'), to: '/calendar', version: 'v0.9' },
    { key: 'polls', label: t('settings.plannedPolls'), to: '/polls', version: 'v0.10' },
  ]);

  async function toggle(feature: Feature, on: boolean): Promise<void> {
    busy.value = feature;
    failure.value = await set(feature, on);
    busy.value = null;
  }

  interface AuditSettingsAnswer {
    settings: { musicRequests: boolean };
    loadError: string | null;
  }

  // Off by default: a music line says only that someone used a feature (decision 018).
  const auditSettings = ref<AuditSettingsAnswer | null>(null);
  const auditError = ref('');
  const auditBusy = ref(false);

  async function loadAuditSettings(): Promise<void> {
    try {
      auditSettings.value = await fetchJson<AuditSettingsAnswer>('/api/settings/audit');
      auditError.value = '';
    } catch (cause) {
      auditError.value = cause instanceof Error ? cause.message : t('settings.auditLoadFailed');
    }
  }

  async function setMusicRequests(on: boolean): Promise<void> {
    auditBusy.value = true;
    try {
      auditSettings.value = await putJson<AuditSettingsAnswer>('/api/settings/audit', {
        musicRequests: on,
      });
      auditError.value = '';
    } catch (cause) {
      auditError.value = cause instanceof Error ? cause.message : t('settings.auditSaveFailed');
    } finally {
      auditBusy.value = false;
    }
  }

  onMounted(() => {
    if (!states.value) {
      void load();
    }
    void loadAuditSettings();
  });
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader :title="t('settings.title')" :description="t('settings.description')" />

    <p v-if="readOnly" class="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm">
      {{ t('settings.readOnly') }}
    </p>

    <div class="flex flex-col gap-5">
      <Card>
        <CardContent class="flex flex-col">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ t('settings.commandChannels') }}</p>
              <p class="text-muted-foreground mt-1 text-xs">
                <I18nT keypath="settings.commandChannelsBody" scope="global">
                  <template #link>
                    <RouterLink to="/music" class="underline underline-offset-2">{{
                      t('settings.musicPage')
                    }}</RouterLink>
                  </template>
                </I18nT>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-base">{{ t('settings.featuresTitle') }}</CardTitle>
          <CardDescription>{{ t('settings.featuresDescription') }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col">
          <StateBlock :loading="!states && !loadError" :error="loadError">
            <div class="flex flex-col">
              <div
                v-for="feature in FEATURE_LIST"
                :key="feature.key"
                class="flex items-center justify-between gap-4 border-b py-3 first:pt-0 last:border-b-0"
              >
                <div class="min-w-0">
                  <RouterLink
                    :to="feature.to"
                    class="hover:text-primary truncate text-sm font-medium transition-colors"
                  >
                    {{ feature.label }}
                  </RouterLink>
                  <p class="text-muted-foreground mt-0.5 text-xs">{{ feature.help }}</p>
                </div>
                <Switch
                  :data-feature="feature.key"
                  :aria-label="feature.label"
                  :model-value="states?.[feature.key] ?? false"
                  :disabled="readOnly || busy !== null"
                  @update:model-value="(value) => toggle(feature.key, value === true)"
                />
              </div>
              <div
                v-for="item in planned"
                :key="item.key"
                class="flex items-center justify-between gap-4 border-b py-3 last:border-b-0 last:pb-0"
              >
                <RouterLink
                  :to="item.to"
                  class="text-muted-foreground hover:text-primary truncate text-sm transition-colors"
                >
                  {{ item.label }}
                </RouterLink>
                <div class="flex shrink-0 items-center gap-2.5">
                  <Badge variant="secondary">{{
                    t('common.plannedBadge', { version: item.version })
                  }}</Badge>
                  <Switch disabled />
                </div>
              </div>
            </div>
          </StateBlock>
          <p v-if="failure" class="text-destructive mt-3 text-xs" role="alert" data-feature-error>
            {{ failure }}
          </p>
        </CardContent>
      </Card>

      <LanguageCard :read-only="readOnly" />

      <SignInMethodsCard :read-only="readOnly" />

      <Card data-audit-settings>
        <CardHeader>
          <CardTitle class="text-base">{{ t('settings.auditTitle') }}</CardTitle>
          <CardDescription>{{ t('settings.auditDescription') }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col">
          <StateBlock
            :loading="!auditSettings && !auditError"
            :error="auditSettings ? '' : auditError"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm font-medium">{{ t('settings.musicRequests') }}</p>
                <p class="text-muted-foreground mt-0.5 text-xs">
                  {{ t('settings.musicRequestsHelp') }}
                </p>
                <p
                  v-if="states && !states.audit"
                  class="text-warning mt-1 text-xs"
                  data-audit-off-note
                >
                  {{ t('settings.auditOff') }}
                </p>
              </div>
              <Switch
                data-audit-music-requests
                :aria-label="t('settings.musicRequests')"
                :model-value="auditSettings?.settings.musicRequests ?? false"
                :disabled="readOnly || auditBusy"
                @update:model-value="(value) => setMusicRequests(value === true)"
              />
            </div>
          </StateBlock>
          <p v-if="auditSettings?.loadError" class="text-destructive mt-3 text-xs" role="alert">
            {{ auditSettings.loadError }}
          </p>
          <p
            v-else-if="auditSettings && auditError"
            class="text-destructive mt-3 text-xs"
            role="alert"
            data-audit-settings-error
          >
            {{ auditError }}
          </p>
        </CardContent>
      </Card>

      <RecapSettingsCard :read-only="readOnly" />

      <Card>
        <CardHeader>
          <CardTitle class="text-base">{{ t('settings.rssTitle') }}</CardTitle>
          <CardDescription>{{ t('settings.rssDescription') }}</CardDescription>
          <CardAction>
            <Badge variant="secondary">{{
              t('common.plannedBadge', { version: 'v0.10.0' })
            }}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="overflow-x-auto">
            <Table class="min-w-120">
              <TableHeader>
                <TableRow>
                  <TableHead>{{ t('settings.rssBlog') }}</TableHead>
                  <TableHead>{{ t('settings.rssUrl') }}</TableHead>
                  <TableHead class="w-28">{{ t('settings.rssStatus') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell class="text-muted-foreground" colspan="3">
                    {{ t('settings.rssEmpty') }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <Button variant="outline" size="sm" class="self-start" disabled>{{
            t('settings.rssAdd')
          }}</Button>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
