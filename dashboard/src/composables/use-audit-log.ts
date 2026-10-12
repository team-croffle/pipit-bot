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

export function useAuditLog() {
  const categories = ref<AuditCategory[]>([]);
  const period = ref<AuditPeriod>('7d');
  const search = ref('');
  const entries = ref<AuditEntry[]>([]);
  const next = ref<string | null>(null);
  const loading = ref(true);
  const loadingMore = ref(false);
  const error = ref('');

  function path(before?: string): string {
    const params = new URLSearchParams({ from: periodStart(period.value) });
    if (categories.value.length > 0) {
      params.set('category', categories.value.join(','));
    }
    if (search.value.trim()) {
      params.set('q', search.value.trim());
    }
    if (before) {
      params.set('before', before);
    }
    return `/api/audit?${params}`;
  }

  async function load(): Promise<void> {
    loading.value = true;
    try {
      const page = await fetchJson<AuditPage>(path());
      entries.value = page.entries;
      next.value = page.next;
      error.value = '';
    } catch (cause) {
      if (!isRedirect(cause)) {
        error.value = cause instanceof Error ? cause.message : '기록을 불러오지 못했습니다.';
      }
    } finally {
      loading.value = false;
    }
  }

  async function loadMore(): Promise<void> {
    if (!next.value) {
      return;
    }

    loadingMore.value = true;
    try {
      const page = await fetchJson<AuditPage>(path(next.value));
      entries.value = [...entries.value, ...page.entries];
      next.value = page.next;
    } catch (cause) {
      if (!isRedirect(cause)) {
        error.value = cause instanceof Error ? cause.message : '기록을 더 불러오지 못했습니다.';
      }
    } finally {
      loadingMore.value = false;
    }
  }

  let debounce: ReturnType<typeof setTimeout> | undefined;
  watch([categories, period], () => void load(), { deep: true });
  watch(search, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void load(), 300);
  });

  return { categories, period, search, entries, next, loading, loadingMore, error, load, loadMore };
}
