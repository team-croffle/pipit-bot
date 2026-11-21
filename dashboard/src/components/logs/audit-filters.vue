<script setup lang="ts">
  import { Search } from 'lucide-vue-next';
  import { computed } from 'vue';
  import { useI18n } from 'vue-i18n';

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
  import { CATEGORIES, categoryLabel } from '@/lib/audit-labels';
  import type { AuditCategory } from '@/types';

  const categories = defineModel<AuditCategory[]>('categories', { required: true });
  const period = defineModel<AuditPeriod>('period', { required: true });
  const search = defineModel<string>('search', { required: true });

  const { t } = useI18n();

  const PERIODS = computed<{ value: AuditPeriod; label: string }[]>(() => [
    { value: 'today', label: t('logs.filters.today') },
    { value: '7d', label: t('logs.filters.last7') },
    { value: '30d', label: t('logs.filters.last30') },
    { value: '90d', label: t('logs.filters.last90') },
  ]);

  function toggle(category: AuditCategory): void {
    categories.value = categories.value.includes(category)
      ? categories.value.filter((item) => item !== category)
      : [...categories.value, category];
  }
</script>

<template>
  <div class="flex flex-col gap-3" data-audit-filters>
    <div class="flex flex-wrap gap-2" role="group" :aria-label="t('logs.filters.categories')">
      <Button
        size="sm"
        :variant="categories.length === 0 ? 'default' : 'outline'"
        :aria-pressed="categories.length === 0"
        data-audit-category="all"
        @click="categories = []"
      >
        {{ t('logs.filters.all') }}
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
        {{ categoryLabel(category) }}
      </Button>
    </div>
    <div class="flex flex-col gap-2 sm:flex-row">
      <Select v-model="period">
        <SelectTrigger
          class="w-full sm:w-40"
          :aria-label="t('logs.filters.period')"
          data-audit-period
        >
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
          :placeholder="t('logs.filters.searchPlaceholder')"
          :aria-label="t('logs.filters.search')"
          data-audit-search
        />
      </div>
    </div>
  </div>
</template>
