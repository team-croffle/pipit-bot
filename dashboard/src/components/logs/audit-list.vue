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
  import { actionLabel, CATEGORY_LABEL, OUTCOME_LABEL } from '@/lib/audit-labels';
  import type { AuditEntry } from '@/types';

  defineProps<{ entries: AuditEntry[] }>();

  const relative = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });

  function ago(at: string): string {
    const seconds = Math.round((new Date(at).getTime() - Date.now()) / 1000);
    const steps: [Intl.RelativeTimeFormatUnit, number][] = [
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];
    for (const [unit, size] of steps) {
      if (Math.abs(seconds) >= size) {
        return relative.format(Math.round(seconds / size), unit);
      }
    }
    return '방금';
  }

  function exact(at: string): string {
    return new Date(at).toLocaleString();
  }

  function outcomeVariant(outcome: AuditEntry['outcome']): 'secondary' | 'destructive' | 'outline' {
    if (outcome === 'failed') {
      return 'destructive';
    }
    return outcome === 'skipped' ? 'outline' : 'secondary';
  }
</script>

<template>
  <!-- Table on wide screens, cards on narrow ones (like the music jobs card). -->
  <div class="hidden overflow-x-auto md:block">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-32">시각</TableHead>
          <TableHead class="w-24">분류</TableHead>
          <TableHead>행동</TableHead>
          <TableHead>누가</TableHead>
          <TableHead>대상 · 내용</TableHead>
          <TableHead class="w-20 text-right">결과</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="(entry, index) in entries"
          :key="`${entry.at}-${index}`"
          data-audit-row
          :data-audit-entry-category="entry.category"
        >
          <TableCell class="text-muted-foreground tnum text-xs" :title="exact(entry.at)">
            {{ ago(entry.at) }}
          </TableCell>
          <TableCell>
            <Badge variant="outline">{{ CATEGORY_LABEL[entry.category] ?? entry.category }}</Badge>
          </TableCell>
          <TableCell class="font-medium">{{ actionLabel(entry.action) }}</TableCell>
          <TableCell class="max-w-40 truncate">{{ entry.actor?.name ?? '—' }}</TableCell>
          <TableCell class="max-w-80">
            <p v-if="entry.target" class="truncate">{{ entry.target }}</p>
            <p
              v-if="entry.detail"
              class="text-muted-foreground truncate text-xs"
              :title="entry.detail"
            >
              {{ entry.detail }}
            </p>
            <p v-if="!entry.target && !entry.detail" class="text-muted-foreground">—</p>
          </TableCell>
          <TableCell class="text-right">
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
        <span class="tnum" :title="exact(entry.at)">· {{ ago(entry.at) }}</span>
      </p>
      <p v-if="entry.target" class="truncate text-sm">{{ entry.target }}</p>
      <p v-if="entry.detail" class="text-muted-foreground text-xs break-words">
        {{ entry.detail }}
      </p>
    </li>
  </ul>
</template>
