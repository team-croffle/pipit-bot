<script setup lang="ts">
  import { Search } from 'lucide-vue-next';

  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import type { AuditPeriod } from '@/composables/use-audit-log';
  import { CATEGORIES, CATEGORY_LABEL } from '@/lib/audit-labels';
  import type { AuditCategory } from '@/types';

  const categories = defineModel<AuditCategory[]>('categories', { required: true });
  const period = defineModel<AuditPeriod>('period', { required: true });
  const search = defineModel<string>('search', { required: true });

  const PERIODS: { value: AuditPeriod; label: string }[] = [
    { value: 'today', label: '오늘' },
    { value: '7d', label: '최근 7일' },
    { value: '30d', label: '최근 30일' },
    { value: '90d', label: '최근 90일' },
  ];

  function toggle(category: AuditCategory): void {
    categories.value = categories.value.includes(category)
      ? categories.value.filter((item) => item !== category)
      : [...categories.value, category];
  }
</script>

<template>
  <div class="flex flex-col gap-3" data-audit-filters>
    <div class="flex flex-wrap gap-2" role="group" aria-label="분류">
      <Button
        size="sm"
        :variant="categories.length === 0 ? 'default' : 'outline'"
        :aria-pressed="categories.length === 0"
        data-audit-category="all"
        @click="categories = []"
      >
        전체
      </Button>
      <Button
        v-for="category in CATEGORIES"
        :key="category"
        size="sm"
        :variant="categories.includes(category) ? 'default' : 'outline'"
        :aria-pressed="categories.includes(category)"
        :data-audit-category="category"
        @click="toggle(category)"
      >
        {{ CATEGORY_LABEL[category] }}
      </Button>
    </div>
    <div class="flex flex-col gap-2 sm:flex-row">
      <Select v-model="period">
        <SelectTrigger class="w-full sm:w-40" aria-label="기간" data-audit-period>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="item in PERIODS"
            :key="item.value"
            :value="item.value"
            :data-audit-period-option="item.value"
          >
            {{ item.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <div class="relative min-w-0 flex-1">
        <Search
          class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-[1.125rem] -translate-y-1/2"
        />
        <Input
          v-model="search"
          class="pl-8"
          type="search"
          placeholder="행동, 사람, 대상, 내용으로 검색"
          aria-label="검색"
          data-audit-search
        />
      </div>
    </div>
  </div>
</template>
