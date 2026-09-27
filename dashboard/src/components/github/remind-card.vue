<script setup lang="ts">
  import { BellRing } from 'lucide-vue-next';
  import { computed, ref } from 'vue';

  import { postJson } from '@/api';
  import SuggestInput from '@/components/common/suggest-input.vue';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import type { DiscordChannel, GithubReminderResult } from '@/types';

  /**
   * The manual reminder — the same one `!pr` sends — from the page.
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

  const repoPattern = /^[\w.-]{1,100}\/[\w.-]{1,100}$/;

  const repo = ref('');
  // A number input hands v-model a number once it parses, and a string while it
  // does not (or when empty) — so the ref takes both and the check reads it as text.
  const number = ref<string | number>('');
  const busy = ref(false);
  const result = ref<GithubReminderResult | null>(null);
  const error = ref('');

  const parsedNumber = computed(() => {
    const value = Number(String(number.value).trim());
    return Number.isInteger(value) && value > 0 ? value : null;
  });

  const canSend = computed(
    () =>
      !props.readOnly &&
      !busy.value &&
      repoPattern.test(repo.value.trim()) &&
      parsedNumber.value !== null,
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

    if (verdict.outcome === 'sent') {
      return `${channelName(verdict.channelId)}에 ${verdict.targets}명을 불렀습니다.`;
    }

    if (verdict.outcome === 'edited') {
      return '새로 보낼 것은 없고, 원래 알림 메시지만 최신 상태로 고쳤습니다.';
    }

    return verdict.outcome === 'failed' ? '보내지 못했습니다.' : '보내지 않았습니다.';
  });

  async function send(): Promise<void> {
    if (!canSend.value || parsedNumber.value === null) {
      return;
    }

    busy.value = true;
    error.value = '';
    result.value = null;
    try {
      result.value = await postJson<GithubReminderResult>('/api/github-notify/remind', {
        repo: repo.value.trim(),
        number: parsedNumber.value,
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
      <CardTitle class="text-base">PR 다시 알리기</CardTitle>
      <CardDescription>
        아직 리뷰하지 않은 리뷰어와 담당자를 저장소의 알림 채널에서 다시 부릅니다. 디스코드에서는
        <code class="font-gothic">!pr owner/name #번호</code>로 같은 일을 할 수 있습니다.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <p v-if="!enabled" class="text-muted-foreground text-sm">
        알림 사용이 꺼져 있어 리마인더도 보내지 않습니다.
      </p>
      <form class="flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="send">
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label for="remind-repo">저장소</Label>
          <SuggestInput
            id="remind-repo"
            v-model="repo"
            :options="repositories"
            list-id="remind-repo-options"
            :loading="repositoriesLoading"
            :disabled="readOnly || busy"
            placeholder="owner/name"
            @open="emit('open')"
          />
        </div>
        <div class="flex flex-col gap-1.5 sm:w-32">
          <Label for="remind-number">PR 번호</Label>
          <Input
            id="remind-number"
            v-model="number"
            type="number"
            min="1"
            inputmode="numeric"
            class="font-gothic"
            placeholder="12"
            :disabled="readOnly || busy"
          />
        </div>
        <Button type="submit" :disabled="!canSend" class="sm:shrink-0">
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
