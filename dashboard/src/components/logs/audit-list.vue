<script setup lang="ts">
  import { Badge } from '@/components/ui/badge';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import {
    actionLabel,
    CATEGORY_LABEL,
    detailLabel,
    OUTCOME_LABEL,
    targetLabel,
    timestamp,
  } from '@/lib/audit-labels';
  import type { AuditEntry } from '@/types';

  defineProps<{ entries: AuditEntry[] }>();

  function outcomeVariant(outcome: AuditEntry['outcome']): 'secondary' | 'destructive' | 'outline' {
    if (outcome === 'failed') {
      return 'destructive';
    }
    return outcome === 'ok' ? 'secondary' : 'outline';
  }
</script>

<template>
  <!-- Table on wide screens, cards on narrow ones (like the music jobs card). -->
  <div class="hidden overflow-x-auto md:block">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-44 text-center">시각</TableHead>
          <TableHead class="w-28 text-center">기능</TableHead>
          <TableHead class="text-center">수행 작업</TableHead>
          <TableHead class="text-center">사용자</TableHead>
          <TableHead class="text-center">대상 · 내용</TableHead>
          <TableHead class="w-28 text-center">결과</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="(entry, index) in entries"
          :key="`${entry.at}-${index}`"
          data-audit-row
          :data-audit-entry-category="entry.category"
        >
          <TableCell class="text-muted-foreground tnum text-xs">
            {{ timestamp(entry.at) }}
          </TableCell>
          <TableCell class="text-center">
            <Badge variant="outline">{{ CATEGORY_LABEL[entry.category] ?? entry.category }}</Badge>
          </TableCell>
          <TableCell class="font-medium">{{ actionLabel(entry.action) }}</TableCell>
          <TableCell class="max-w-40 truncate">{{ entry.actor?.name ?? '—' }}</TableCell>
          <TableCell class="max-w-80">
            <p v-if="targetLabel(entry)" class="truncate">{{ targetLabel(entry) }}</p>
            <p
              v-if="detailLabel(entry)"
              class="text-muted-foreground truncate text-xs"
              :title="detailLabel(entry)"
            >
              {{ detailLabel(entry) }}
            </p>
            <p v-if="!entry.target && !entry.detail" class="text-muted-foreground">—</p>
          </TableCell>
          <TableCell class="text-center">
            <Badge :variant="outcomeVariant(entry.outcome)">{{
              OUTCOME_LABEL[entry.outcome]
            }}</Badge>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>

  <ul class="flex list-none flex-col gap-2 p-0 md:hidden">
    <li
      v-for="(entry, index) in entries"
      :key="`${entry.at}-${index}`"
      data-audit-card
      class="border-border flex min-w-0 flex-col gap-1 rounded-md border p-3"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="min-w-0 truncate font-medium">{{ actionLabel(entry.action) }}</span>
        <Badge :variant="outcomeVariant(entry.outcome)" class="shrink-0">
          {{ OUTCOME_LABEL[entry.outcome] }}
        </Badge>
      </div>
      <p class="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
        <span>{{ CATEGORY_LABEL[entry.category] ?? entry.category }}</span>
        <span v-if="entry.actor">· {{ entry.actor.name }}</span>
        <span class="tnum">· {{ timestamp(entry.at) }}</span>
      </p>
      <p v-if="targetLabel(entry)" class="truncate text-sm">{{ targetLabel(entry) }}</p>
      <p v-if="detailLabel(entry)" class="text-muted-foreground text-xs break-words">
        {{ detailLabel(entry) }}
      </p>
    </li>
  </ul>
</template>
