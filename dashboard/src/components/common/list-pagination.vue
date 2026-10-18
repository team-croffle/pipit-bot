<script setup lang="ts">
  import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
  import { computed } from 'vue';

  import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
  } from '@/components/ui/pagination';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';

  /**
   * Numbered pages under a list, with an optional choice of how many rows a page holds.
   * The list itself does the slicing or the fetching; this only says which page.
   */
  const props = defineProps<{
    total: number;
    /** Rows per page; with `sizes`, the choice offered beside the pages. */
    sizes?: number[];
    label?: string;
  }>();

  const page = defineModel<number>('page', { required: true });
  const pageSize = defineModel<number>('pageSize', { required: true });

  const pageCount = computed(() => Math.max(1, Math.ceil(props.total / pageSize.value)));

  function setSize(value: unknown): void {
    const size = Number(value);
    if (Number.isInteger(size) && size !== pageSize.value) {
      pageSize.value = size;
      page.value = 1;
    }
  }
</script>

<template>
  <div
    class="flex flex-col items-center justify-between gap-3 sm:flex-row"
    :data-pagination="label ?? 'list'"
  >
    <div v-if="sizes?.length" class="text-muted-foreground flex items-center gap-2 text-sm">
      <span>줄 수</span>
      <Select :model-value="String(pageSize)" @update:model-value="setSize">
        <SelectTrigger size="sm" class="w-20" aria-label="한 페이지 줄 수" data-page-size>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="size in sizes"
            :key="size"
            :value="String(size)"
            :data-page-size-option="size"
          >
            {{ size }}
          </SelectItem>
        </SelectContent>
      </Select>
      <span class="tnum">· 전체 {{ total }}</span>
    </div>
    <Pagination
      v-if="pageCount > 1"
      v-slot="{ page: current }"
      :page="page"
      :total="total"
      :items-per-page="pageSize"
      :sibling-count="1"
      show-edges
      class="mx-0 w-auto"
      @update:page="(value: number) => (page = value)"
    >
      <PaginationContent v-slot="{ items }">
        <PaginationPrevious aria-label="이전 페이지" data-page-prev>
          <ChevronLeft />
          <span class="hidden sm:block">이전</span>
        </PaginationPrevious>
        <template v-for="(item, index) in items" :key="index">
          <PaginationItem
            v-if="item.type === 'page'"
            :value="item.value"
            :is-active="item.value === current"
            :data-page="item.value"
          >
            {{ item.value }}
          </PaginationItem>
          <PaginationEllipsis v-else :index="index" />
        </template>
        <PaginationNext aria-label="다음 페이지" data-page-next>
          <span class="hidden sm:block">다음</span>
          <ChevronRight />
        </PaginationNext>
      </PaginationContent>
    </Pagination>
  </div>
</template>
