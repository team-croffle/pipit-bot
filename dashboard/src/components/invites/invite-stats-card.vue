<script setup lang="ts">
  import { onMounted, ref } from 'vue';

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
  import type { InviteRow, InvitesResponse } from '@/types';

  const invites = ref<InviteRow[]>([]);
  const canListInvites = ref(true);
  const hasUseCounts = ref(true);
  const loadError = ref('');
  const error = ref('');
  const loading = ref(true);

  function when(at: string | null): string {
    return at ? new Date(at).toLocaleString() : '—';
  }

  function expiry(row: InviteRow): string {
    if (!row.active) {
      return '사라짐';
    }
    return row.expiresAt ? `${new Date(row.expiresAt).toLocaleDateString()} 만료` : '만료 없음';
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
        error.value = cause instanceof Error ? cause.message : '초대 목록을 불러오지 못했습니다.';
      }
    } finally {
      loading.value = false;
    }
  });
</script>

<template>
  <Card data-invite-stats>
    <CardHeader>
      <CardTitle class="text-base">초대 코드별 유입</CardTitle>
      <CardDescription>
        봇이 본 입장 수를 코드별로 셉니다. 초대가 사라져도 수는 남습니다.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <Alert v-if="!loading && (!canListInvites || !hasUseCounts)" data-invite-warning>
        <AlertDescription>
          봇에게 <b>서버 관리</b> 권한이 없어 초대의 사용 횟수를 볼 수 없습니다. 이 상태로는 새
          멤버가 어떤 초대로 들어왔는지 알 수 없어 유입이 세어지지 않습니다. 봇 역할에 서버 관리
          권한을 주세요.
        </AlertDescription>
      </Alert>
      <p v-if="loadError" class="text-destructive text-sm" role="alert">{{ loadError }}</p>
      <StateBlock
        :loading="loading"
        :error="error"
        :empty="invites.length === 0"
        empty-text="아직 기록된 초대가 없습니다."
      >
        <div class="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>코드</TableHead>
                <TableHead>만든 사람</TableHead>
                <TableHead class="text-right">유입</TableHead>
                <TableHead class="text-right">사용</TableHead>
                <TableHead>최근 유입</TableHead>
                <TableHead>상태</TableHead>
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
              <span class="tnum shrink-0 font-medium">유입 {{ row.joins }}</span>
            </div>
            <p class="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
              <span>{{ row.inviterName ?? '만든 사람 모름' }}</span>
              <span>· 사용 {{ serverUses(row) }}</span>
              <span>· {{ expiry(row) }}</span>
            </p>
            <p class="text-muted-foreground tnum text-xs">최근 유입 {{ when(row.lastJoinAt) }}</p>
          </li>
        </ul>
      </StateBlock>
    </CardContent>
  </Card>
</template>
