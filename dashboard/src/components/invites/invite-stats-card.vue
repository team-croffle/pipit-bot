<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { useI18n } from 'vue-i18n';

  import { fetchJson } from '@/api';
  import StateBlock from '@/components/common/state-block.vue';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import { intlLocale } from '@/i18n';
  import type { InviteRow, InvitesResponse } from '@/types';

  const { t } = useI18n();

  const invites = ref<InviteRow[]>([]);
  const canListInvites = ref(true);
  const hasUseCounts = ref(true);
  const loadError = ref('');
  const error = ref('');
  const loading = ref(true);

  function when(at: string | null): string {
    return at ? new Date(at).toLocaleString(intlLocale()) : '—';
  }

  function expiry(row: InviteRow): string {
    if (!row.active) {
      return t('invites.stats.gone');
    }
    return row.expiresAt
      ? t('invites.stats.expires', {
          date: new Date(row.expiresAt).toLocaleDateString(intlLocale()),
        })
      : t('invites.stats.noExpiry');
  }

  function serverUses(row: InviteRow): string {
    if (row.uses === null) {
      return '—';
    }
    return row.maxUses ? `${row.uses}/${row.maxUses}` : String(row.uses);
  }

  onMounted(async () => {
    try {
      const body = await fetchJson<InvitesResponse>('/api/invites');
      invites.value = body.invites;
      canListInvites.value = body.canListInvites;
      hasUseCounts.value = body.hasUseCounts;
      loadError.value = body.loadError ?? '';
    } catch (cause) {
      if (!(cause instanceof Error && cause.message.startsWith('Redirecting to login'))) {
        error.value = cause instanceof Error ? cause.message : t('invites.stats.loadFailed');
      }
    } finally {
      loading.value = false;
    }
  });
</script>

<template>
  <Card data-invite-stats>
    <CardHeader>
      <CardTitle class="text-base">{{ t('invites.stats.title') }}</CardTitle>
      <CardDescription>
        {{ t('invites.stats.description') }}
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <Alert v-if="!loading && (!canListInvites || !hasUseCounts)" data-invite-warning>
        <AlertDescription>
          {{ t('invites.stats.warningBefore') }}<b>{{ t('invites.stats.manageServer') }}</b
          >{{ t('invites.stats.warningAfter') }}
        </AlertDescription>
      </Alert>
      <p v-if="loadError" class="text-destructive text-sm" role="alert">{{ loadError }}</p>
      <StateBlock
        :loading="loading"
        :error="error"
        :empty="invites.length === 0"
        :empty-text="t('invites.stats.empty')"
      >
        <div class="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('invites.stats.code') }}</TableHead>
                <TableHead>{{ t('invites.stats.inviter') }}</TableHead>
                <TableHead class="text-right">{{ t('invites.stats.joins') }}</TableHead>
                <TableHead class="text-right">{{ t('invites.stats.uses') }}</TableHead>
                <TableHead>{{ t('invites.stats.lastJoin') }}</TableHead>
                <TableHead>{{ t('invites.stats.status') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in invites" :key="row.code" data-invite-row>
                <TableCell class="font-mono">{{ row.code }}</TableCell>
                <TableCell class="max-w-40 truncate">{{ row.inviterName ?? '—' }}</TableCell>
                <TableCell class="tnum text-right font-medium">{{ row.joins }}</TableCell>
                <TableCell class="tnum text-muted-foreground text-right">
                  {{ serverUses(row) }}
                </TableCell>
                <TableCell class="text-muted-foreground tnum text-xs">
                  {{ when(row.lastJoinAt) }}
                </TableCell>
                <TableCell>
                  <Badge :variant="row.active ? 'outline' : 'secondary'">{{ expiry(row) }}</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <ul class="flex list-none flex-col gap-2 p-0 md:hidden">
          <li
            v-for="row in invites"
            :key="row.code"
            data-invite-card
            class="border-border flex min-w-0 flex-col gap-1 rounded-md border p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-mono">{{ row.code }}</span>
              <span class="tnum shrink-0 font-medium">{{
                t('invites.stats.joinsCount', { count: row.joins })
              }}</span>
            </div>
            <p class="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
              <span>{{ row.inviterName ?? t('invites.stats.unknownInviter') }}</span>
              <span>{{ t('invites.stats.usesCount', { uses: serverUses(row) }) }}</span>
              <span>· {{ expiry(row) }}</span>
            </p>
            <p class="text-muted-foreground tnum text-xs">
              {{ t('invites.stats.lastJoinAt', { at: when(row.lastJoinAt) }) }}
            </p>
          </li>
        </ul>
      </StateBlock>
    </CardContent>
  </Card>
</template>
