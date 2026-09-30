<script setup lang="ts">
  import { BellRing } from 'lucide-vue-next';
  import { computed, ref, watch } from 'vue';

  import { postJson } from '@/api';
  import RepoSelect from '@/components/common/repo-select.vue';
  import ItemSelect from '@/components/github/item-select.vue';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Label } from '@/components/ui/label';
  import type { DiscordChannel, GithubReminderResult } from '@/types';

  /**
   * The manual reminder — the same one `!remind` sends — from the page. Pull requests
   * and issues share one number space, so the server says which one it was.
   *
   * The card does not know whether the App credentials exist: the server answers
   * with a skipped verdict that says so, and that reads better than a greyed-out
   * form with no explanation.
   */
  const props = defineProps<{
    readOnly: boolean;
    enabled: boolean;
    repositories: string[];
    repositoriesLoading: boolean;
    channels: DiscordChannel[];
  }>();

  const emit = defineEmits<{ open: []; reminded: [] }>();

  // `owner/name`, or a name alone that the server matches against the installed list.
  const repoPattern = /^[\w.-]{1,100}(?:\/[\w.-]{1,100})?$/;
  const KIND_LABEL = { pull: 'PR', issue: 'Issue' } as const;

  const repo = ref('');
  // The picker hands over a positive integer, or '' while there is none.
  const number = ref<number | ''>('');
  const busy = ref(false);
  const result = ref<GithubReminderResult | null>(null);
  const error = ref('');

  // A number picked for one repository means nothing for the next.
  watch(repo, () => {
    number.value = '';
  });

  const canSend = computed(
    () =>
      !props.readOnly && !busy.value && repoPattern.test(repo.value.trim()) && number.value !== '',
  );

  function channelName(channelId: string | undefined): string {
    const channel = props.channels.find((item) => item.id === channelId);
    return channel ? `#${channel.name}` : '알림 채널';
  }

  const summary = computed(() => {
    const verdict = result.value;
    if (!verdict) {
      return '';
    }

    const kind = verdict.kind ? ` (${KIND_LABEL[verdict.kind]})` : '';
    if (verdict.outcome === 'sent') {
      return `${channelName(verdict.channelId)}에 ${verdict.targets}명을 불렀습니다${kind}.`;
    }

    if (verdict.outcome === 'edited') {
      return `이미 끝난 항목이라 새로 보내지 않고, 처음 알림 메시지만 최신 상태로 고쳤습니다${kind}.`;
    }

    return verdict.outcome === 'failed' ? '보내지 못했습니다.' : '보내지 않았습니다.';
  });

  async function send(): Promise<void> {
    if (!canSend.value || number.value === '') {
      return;
    }

    busy.value = true;
    error.value = '';
    result.value = null;
    try {
      result.value = await postJson<GithubReminderResult>('/api/github-notify/remind', {
        repo: repo.value.trim(),
        number: number.value,
      });
      emit('reminded');
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '요청하지 못했습니다.';
    } finally {
      busy.value = false;
    }
  }
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">다시 알리기</CardTitle>
      <CardDescription>
        PR은 아직 리뷰하지 않은 리뷰어와 담당자를, Issue는 담당자를 저장소의 알림 채널에서 다시
        부릅니다. 열린 PR·Issue는 목록에서 고르고, 닫힌 항목은 번호를 직접 넣습니다. 디스코드에서는
        <code class="font-gothic">!remind owner/name #번호</code>로 같은 일을 할 수 있습니다.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <p v-if="!enabled" class="text-muted-foreground text-sm">
        알림 사용이 꺼져 있어 리마인더도 보내지 않습니다.
      </p>
      <!-- items-start, not items-end: the pickers grow a hint line underneath, and the
           button lines up with the fields (label + gap = mt-5), not with the hints. -->
      <form class="flex flex-col gap-3 sm:flex-row sm:items-start" @submit.prevent="send">
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label for="remind-repo">저장소</Label>
          <RepoSelect
            id="remind-repo"
            v-model="repo"
            :options="repositories"
            :loading="repositoriesLoading"
            :disabled="readOnly || busy"
            placeholder="owner/name 또는 name"
            @open="emit('open')"
          />
        </div>
        <div class="flex min-w-0 flex-col gap-1.5 sm:w-64">
          <Label for="remind-number">PR · Issue</Label>
          <ItemSelect
            id="remind-number"
            v-model="number"
            :repo="repo"
            :disabled="readOnly || busy"
          />
        </div>
        <Button type="submit" :disabled="!canSend" class="sm:mt-5 sm:shrink-0">
          <BellRing />
          {{ busy ? '보내는 중…' : '다시 알리기' }}
        </Button>
      </form>
      <Alert v-if="error" variant="destructive">
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
      <Alert v-else-if="result" :variant="result.outcome === 'failed' ? 'destructive' : 'default'">
        <AlertDescription class="flex flex-col gap-1">
          <span>{{ summary }}</span>
          <span v-if="result.detail" class="text-muted-foreground text-xs">
            {{ result.detail }}
          </span>
        </AlertDescription>
      </Alert>
      <p class="text-muted-foreground text-xs">
        같은 PR은 5분에 한 번만 보냅니다. 초안·머지됨·닫힘이거나 기다리는 사람이 없으면 보내지 않고
        사유만 아래 최근 발송에 남습니다.
      </p>
    </CardContent>
  </Card>
</template>
