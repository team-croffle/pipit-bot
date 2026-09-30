import { computed, nextTick, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

/**
 * What the dashboard's pickers share, so they look and behave as one family.
 *
 * reka-ui carries a Select's selection as a plain value, and an empty string reads
 * as "nothing selected" to it. An unset picker therefore rides through the
 * component as `EMPTY`, and the "직접 입력…" entry as `MANUAL`; both are mapped back
 * before anything reaches the parent.
 */
export const EMPTY = '__none__';
export const MANUAL = '__manual__';

/** The copy every picker uses for the same thing. */
export const PICKER_TEXT = {
  manual: '직접 입력…',
  back: '목록에서 고르기',
  loading: '목록을 불러오는 중…',
} as const;

interface ManualFallbackSource {
  value: () => string;
  /** The value is one of the list's entries. */
  known: () => boolean;
  count: () => number;
  loading: () => boolean | undefined;
  /** The parent knows the list cannot be had at all. */
  unavailable?: () => boolean | undefined;
  /** Tell the parent the picker opened — lists are fetched on first use. */
  requestList: () => void;
}

interface ManualFallback {
  manual: Ref<boolean>;
  /** The list has arrived and holds nothing. */
  emptyList: ComputedRef<boolean>;
  onOpen: (open: boolean) => void;
  /** Maps a Select value back to the model value, switching modes on the way. */
  pick: (next: string) => string;
}

/**
 * The "직접 입력" escape hatch of a picker whose list is fetched lazily.
 *
 * WHY "settled": before the first fetch an empty list only means "not asked yet".
 * Judging a saved value against it would push every saved row into a text field on
 * page load, so a value the list does not know — or a list that came back empty —
 * switches the field to manual entry only once the list has actually arrived (the
 * trigger shows the raw value until then).
 */
export function useManualFallback(source: ManualFallbackSource): ManualFallback {
  const manual = ref(false);
  const settled = ref(source.count() > 0);

  watch([source.loading, source.count], ([loading, count], [wasLoading]) => {
    if (count > 0 || (wasLoading && !loading)) {
      settled.value = true;
    }
  });

  const emptyList = computed(() => settled.value && !source.loading() && source.count() === 0);

  watch(
    () =>
      [
        source.value(),
        source.count(),
        source.loading(),
        source.unavailable?.(),
        settled.value,
      ] as const,
    () => {
      if (source.unavailable?.()) {
        manual.value = true;
        return;
      }

      if (!settled.value || source.loading()) {
        return;
      }

      if (source.count() === 0 || (source.value() && !source.known())) {
        manual.value = true;
      }
    },
    { immediate: true },
  );

  function onOpen(open: boolean): void {
    if (!open) {
      return;
    }

    source.requestList();
    // The parent flips `loading` synchronously in its handler; by the next tick we
    // know whether a fetch is on its way or the list it already has is final.
    void nextTick(() => {
      if (!source.loading()) {
        settled.value = true;
      }
    });
  }

  function pick(next: string): string {
    manual.value = next === MANUAL;
    return next === MANUAL || next === EMPTY ? '' : next;
  }

  return { manual, emptyList, onOpen, pick };
}
