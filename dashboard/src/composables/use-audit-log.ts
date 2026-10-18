import { ref, watch } from 'vue';

import { fetchJson } from '@/api';
import type { AuditCategory, AuditEntry, AuditPage } from '@/types';

export type AuditPeriod = 'today' | '7d' | '30d' | '90d';

const PERIOD_DAYS: Record<AuditPeriod, number> = { today: 0, '7d': 7, '30d': 30, '90d': 90 };

/** The start of the period, in UTC, as the API takes it. */
function periodStart(period: AuditPeriod): string {
  const start = new Date();
  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - PERIOD_DAYS[period]);
  }

  return start.toISOString();
}

function isRedirect(cause: unknown): boolean {
  return cause instanceof Error && cause.message.startsWith('Redirecting to login');
}

export const AUDIT_PAGE_SIZES = [5, 10, 20, 30];

/** Numbered pages: a filter change goes back to page 1, a page or size change refetches. */
export function useAuditLog() {
  const categories = ref<AuditCategory[]>([]);
  const period = ref<AuditPeriod>('7d');
  const search = ref('');
  const entries = ref<AuditEntry[]>([]);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(20);
  const loading = ref(true);
  const error = ref('');

  function path(): string {
    const params = new URLSearchParams({
      from: periodStart(period.value),
      page: String(page.value),
      limit: String(pageSize.value),
    });
    if (categories.value.length > 0) {
      params.set('category', categories.value.join(','));
    }
    if (search.value.trim()) {
      params.set('q', search.value.trim());
    }
    return `/api/audit?${params}`;
  }

  async function load(): Promise<void> {
    loading.value = true;
    try {
      const result = await fetchJson<AuditPage>(path());
      entries.value = result.entries;
      total.value = result.total ?? result.entries.length;
      // A page past the end (rows gone since, or a larger size) moves to the last one.
      const last = Math.max(1, Math.ceil(total.value / pageSize.value));
      if (page.value > last) {
        page.value = last;
        return;
      }
      error.value = '';
    } catch (cause) {
      if (!isRedirect(cause)) {
        error.value = cause instanceof Error ? cause.message : '기록을 불러오지 못했습니다.';
      }
    } finally {
      loading.value = false;
    }
  }

  function firstPageThenLoad(): void {
    if (page.value === 1) {
      void load();
    } else {
      page.value = 1;
    }
  }

  let debounce: ReturnType<typeof setTimeout> | undefined;
  watch([categories, period], firstPageThenLoad, { deep: true });
  watch([page, pageSize], () => void load());
  watch(search, () => {
    clearTimeout(debounce);
    debounce = setTimeout(firstPageThenLoad, 300);
  });

  return { categories, period, search, entries, total, page, pageSize, loading, error, load };
}
