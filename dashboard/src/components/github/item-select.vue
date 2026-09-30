<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue';

  import { fetchJson } from '@/api';
  import { Badge } from '@/components/ui/badge';
  import { Input } from '@/components/ui/input';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import { EMPTY, MANUAL, PICKER_TEXT } from '@/lib/picker';
  import type { GithubOpenItem, GithubOpenItemList } from '@/types';

  /**
   * Picks an open pull request or issue of one repository, with "직접 입력" as the
   * way out — the same shape as the repository and account pickers.
   *
   * WHY the escape hatch: the list only holds open items (a reminder for a closed
   * one is still a valid request — the server answers it with an edit), it is capped,
   * and it cannot be fetched at all without the App credentials or for a repository
   * the App is not installed on. A typed number is what the server checks anyway.
   *
   * `modelValue` is the chosen number, or `''` while there is none (nothing picked,
   * or a typed value that is not a positive integer) — so the parent only has to
   * compare against `''`.
   */
  const props = defineProps<{
    modelValue: number | '';
    /** `owner/name`; a name alone cannot be listed and falls back to manual entry. */
    repo: string;
    disabled?: boolean;
    id?: string;
  }>();

  const emit = defineEmits<{ 'update:modelValue': [number | ''] }>();

  const FULL_NAME = /^[\w.-]+\/[\w.-]+$/;
  const KIND_LABEL = { pull: 'PR', issue: 'Issue' } as const;
  const REASON_HINT = {
    'no-credentials':
      'GitHub App 자격증명이 없어 목록을 불러올 수 없습니다 — 번호를 직접 입력하세요.',
    'not-installed': '이 저장소는 App에 설치돼 있지 않습니다 — 번호를 직접 입력하세요.',
    'request-failed': '목록을 가져오지 못했습니다 — 번호를 직접 입력하세요.',
  } as const;

  const repoName = computed(() => props.repo.trim());
  const listable = computed(() => FULL_NAME.test(repoName.value));

  const list = ref<GithubOpenItemList | null>(null);
  const loading = ref(false);
  // The person chose "직접 입력" although a list is there.
  const chosenManual = ref(false);
  // What the manual input shows — kept apart from the model so a half-typed or
  // invalid value (which the model carries as '') is not wiped while typing.
  const typed = ref('');

  let timer: ReturnType<typeof setTimeout> | undefined;
  // Bumped on every repository change; a response for an older one is dropped.
  let generation = 0;

  async function load(repo: string, ticket: number): Promise<void> {
    const [owner, name] = repo.split('/');
    let body: GithubOpenItemList;
    try {
      body = await fetchJson<GithubOpenItemList>(
        `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/open-items`,
      );
    } catch {
      body = { available: false, items: [], truncated: false, reason: 'request-failed' };
    }

    if (ticket !== generation) {
      return;
    }

    list.value = body;
    loading.value = false;
  }

  watch(
    repoName,
    (repo) => {
      generation += 1;
      clearTimeout(timer);
      list.value = null;
      chosenManual.value = false;
      loading.value = FULL_NAME.test(repo);
      if (!loading.value) {
        return;
      }

      const ticket = generation;
      timer = setTimeout(() => void load(repo, ticket), 300);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => clearTimeout(timer));

  // The parent clears the number (a repository change): the typed text goes too.
  watch(
    () => props.modelValue,
    (value) => {
      if (value === '' && parse(typed.value) !== '') {
        typed.value = '';
      } else if (value !== '' && parse(typed.value) !== value) {
        typed.value = String(value);
      }
    },
    { immediate: true },
  );

  function parse(text: string): number | '' {
    const value = Number(text.trim());
    return text.trim() !== '' && Number.isInteger(value) && value > 0 ? value : '';
  }

  const items = computed<GithubOpenItem[]>(() => list.value?.items ?? []);

  /** Why the field is manual without the person asking for it, or null. */
  const forcedHint = computed(() => {
    if (!repoName.value || loading.value) {
      return null;
    }
    if (!listable.value) {
      return '저장소를 owner/name으로 고르면 열린 항목을 불러옵니다';
    }
    if (list.value && !list.value.available) {
      return REASON_HINT[list.value.reason ?? 'request-failed'];
    }
    if (list.value && items.value.length === 0) {
      return '열린 PR·Issue가 없습니다 — 번호를 직접 입력하세요.';
    }

    return null;
  });

  const manual = computed(() => forcedHint.value !== null || chosenManual.value);

  const current = computed(() => items.value.find((item) => item.number === props.modelValue));

  const selected = computed({
    get: () => (current.value ? String(current.value.number) : EMPTY),
    set: (next: string) => {
      if (next === MANUAL) {
        chosenManual.value = true;
        typed.value = '';
        emit('update:modelValue', '');
        return;
      }

      emit('update:modelValue', next === EMPTY ? '' : Number(next));
    },
  });

  function onType(text: string | number): void {
    typed.value = String(text);
    emit('update:modelValue', parse(typed.value));
  }

  function backToList(): void {
    chosenManual.value = false;
    // A typed number the list does not hold would sit behind an empty trigger.
    if (!current.value) {
      typed.value = '';
      emit('update:modelValue', '');
    }
  }
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <Input
      v-if="manual"
      :id="id"
      :model-value="typed"
      type="number"
      min="1"
      inputmode="numeric"
      placeholder="12"
      class="font-gothic"
      autocomplete="off"
      :disabled="disabled"
      @update:model-value="onType"
    />
    <Select v-else v-model="selected" :disabled="disabled || !repoName || loading">
      <SelectTrigger :id="id" class="w-full min-w-0">
        <SelectValue placeholder="PR · Issue 선택">
          <span v-if="current" class="truncate">
            <span class="font-gothic">#{{ current.number }}</span> · {{ current.title }}
          </span>
          <span v-else-if="!repoName" class="text-muted-foreground">저장소를 먼저 고르세요</span>
          <span v-else-if="loading" class="text-muted-foreground">{{ PICKER_TEXT.loading }}</span>
          <span v-else>PR · Issue 선택</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="item in items" :key="item.number" :value="String(item.number)">
          <span class="flex min-w-0 items-center gap-2">
            <span class="truncate">
              <span class="font-gothic">#{{ item.number }}</span> · {{ item.title }}
            </span>
            <Badge variant="secondary" data-item-kind>{{ KIND_LABEL[item.kind] }}</Badge>
            <Badge v-if="item.draft" variant="outline" data-item-draft>초안</Badge>
          </span>
        </SelectItem>
        <SelectItem :value="MANUAL">{{ PICKER_TEXT.manual }}</SelectItem>
      </SelectContent>
    </Select>
    <p v-if="forcedHint" class="text-muted-foreground text-xs" data-item-hint>{{ forcedHint }}</p>
    <button
      v-else-if="manual"
      type="button"
      class="text-muted-foreground hover:text-foreground self-start text-xs underline"
      :disabled="disabled"
      @click="backToList"
    >
      {{ PICKER_TEXT.back }}
    </button>
    <p v-else-if="list?.truncated" class="text-muted-foreground text-xs" data-item-hint>
      최근 100건만 표시됩니다 — 없는 번호는 직접 입력하세요.
    </p>
  </div>
</template>
