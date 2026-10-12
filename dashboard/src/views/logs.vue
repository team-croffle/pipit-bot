<script setup lang="ts">
  import { RefreshCw } from 'lucide-vue-next';
  import { onMounted } from 'vue';

  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import AuditFilters from '@/components/logs/audit-filters.vue';
  import AuditList from '@/components/logs/audit-list.vue';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent } from '@/components/ui/card';
  import { useAuditLog } from '@/composables/use-audit-log';

  const { categories, period, search, entries, next, loading, loadingMore, error, load, loadMore } =
    useAuditLog();

  onMounted(load);
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader
      title="로깅"
      description="대시보드·디스코드에서 한 조작, GitHub 알림, 멤버 입장·퇴장 기록. 음악은 누가 어떤 기능을 썼는지만 남깁니다 · 90일 보관"
    >
      <template #actions>
        <Button variant="outline" size="sm" :disabled="loading" data-audit-refresh @click="load">
          <RefreshCw :class="loading ? 'animate-spin' : ''" />
          새로고침
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
          empty-text="이 조건에 맞는 기록이 없습니다."
        >
          <AuditList :entries="entries" />
          <Button
            v-if="next"
            variant="outline"
            class="self-center"
            :disabled="loadingMore"
            data-audit-more
            @click="loadMore"
          >
            {{ loadingMore ? '불러오는 중…' : '더 보기' }}
          </Button>
        </StateBlock>
      </CardContent>
    </Card>
  </div>
</template>
