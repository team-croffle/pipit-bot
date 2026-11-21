<script setup lang="ts">
  import { BellRing } from 'lucide-vue-next';
  import { computed, ref, watch } from 'vue';
  import { I18nT, useI18n } from 'vue-i18n';

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
  const { t } = useI18n();

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
    return channel ? `#${channel.name}` : t('github.remind.fallbackChannel');
  }

  const summary = computed(() => {
    const verdict = result.value;
    if (!verdict) {
      return '';
    }

    const kind = verdict.kind ? ` (${KIND_LABEL[verdict.kind]})` : '';
    if (verdict.outcome === 'sent') {
      return t(
        'github.remind.sent',
        { channel: channelName(verdict.channelId), count: verdict.targets, kind },
        verdict.targets,
      );
    }

    if (verdict.outcome === 'edited') {
      return t('github.remind.edited', { kind });
    }

    return verdict.outcome === 'failed' ? t('github.remind.failed') : t('github.remind.skipped');
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
      error.value = cause instanceof Error ? cause.message : t('github.remind.requestFailed');
    } finally {
      busy.value = false;
    }
  }
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">{{ t('github.remind.title') }}</CardTitle>
      <CardDescription>
        <I18nT keypath="github.remind.description" scope="global">
          <template #command>
            <code class="font-gothic">!remind owner/name #{{ t('github.remind.numberWord') }}</code>
          </template>
        </I18nT>
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <p v-if="!enabled" class="text-muted-foreground text-sm">
        {{ t('github.remind.off') }}
      </p>
      <!-- items-start, not items-end: the pickers grow a hint line underneath, and the
           button lines up with the fields (label + gap = mt-5), not with the hints. -->
      <form class="flex flex-col gap-3 sm:flex-row sm:items-start" @submit.prevent="send">
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label for="remind-repo">{{ t('github.remind.repo') }}</Label>
          <RepoSelect
            id="remind-repo"
            v-model="repo"
            :options="repositories"
            :loading="repositoriesLoading"
            :disabled="readOnly || busy"
            :placeholder="t('github.repoSelect.placeholder')"
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
          {{ busy ? t('github.remind.sending') : t('github.remind.send') }}
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
        {{ t('github.remind.rateNote') }}
      </p>
    </CardContent>
  </Card>
</template>
