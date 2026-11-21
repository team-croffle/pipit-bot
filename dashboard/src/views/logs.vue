<script setup lang="ts">
  import { RefreshCw } from 'lucide-vue-next';
  import { onMounted } from 'vue';
  import { useI18n } from 'vue-i18n';

  import ListPagination from '@/components/common/list-pagination.vue';
  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import AuditFilters from '@/components/logs/audit-filters.vue';
  import AuditList from '@/components/logs/audit-list.vue';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent } from '@/components/ui/card';
  import { AUDIT_PAGE_SIZES, useAuditLog } from '@/composables/use-audit-log';

  const { categories, period, search, entries, total, page, pageSize, loading, error, load } =
    useAuditLog();
  const { t } = useI18n();

  onMounted(load);
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader :title="t('logs.title')" :description="t('logs.description')">
      <template #actions>
        <Button variant="outline" size="sm" :disabled="loading" data-audit-refresh @click="load">
          <RefreshCw :class="loading ? 'animate-spin' : ''" />
          {{ t('logs.refresh') }}
        </Button>
      </template>
    </PageHeader>

    <Card>
      <CardContent class="flex flex-col gap-4">
        <AuditFilters
          v-model:categories="categories"
          v-model:period="period"
          v-model:search="search"
        />
        <StateBlock
          :loading="loading"
          :error="error"
          :empty="entries.length === 0"
          :empty-text="t('logs.empty')"
        >
          <AuditList :entries="entries" />
        </StateBlock>
        <ListPagination
          v-if="total > 0"
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="total"
          :sizes="AUDIT_PAGE_SIZES"
          label="audit"
        />
      </CardContent>
    </Card>
  </div>
</template>
