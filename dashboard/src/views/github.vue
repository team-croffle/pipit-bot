<script setup lang="ts">
  import { Plus, RefreshCw, Trash2 } from 'lucide-vue-next';
  import { onMounted, ref } from 'vue';

  import { fetchJson, putJson } from '@/api';
  import ChannelSelect from '@/components/common/channel-select.vue';
  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
  import { Separator } from '@/components/ui/separator';
  import { Switch } from '@/components/ui/switch';
  import { Textarea } from '@/components/ui/textarea';
  import type {
    DashboardIdentity,
    DiscordChannel,
    DiscordMember,
    GithubAccountMapping,
    GithubDelivery,
    GithubEventTemplates,
    GithubEventToggles,
    GithubNotifySettings,
    GithubRepoRule,
  } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;

  const repoPattern = /^[\w.-]{1,100}\/[\w.-]{1,100}$/;
  const loginPattern = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

  const templateVariables = [
    'repo',
    'pr_number',
    'pr_url',
    'pr_title',
    'event',
    'actor',
    'author',
    'assignees',
    'reviewers',
    'mentions',
  ];

  const eventLabels: { key: keyof GithubEventToggles; label: string }[] = [
    { key: 'pullRequestOpened', label: 'PR 등록' },
    { key: 'pullRequestUpdated', label: 'PR 업데이트 (새 커밋 · rebase)' },
    { key: 'pullRequestMerged', label: 'PR 머지' },
    { key: 'pullRequestAssigned', label: 'PR 리뷰어 / 담당자 배정' },
    { key: 'issueOpened', label: 'Issue 등록' },
    { key: 'issueAssigned', label: 'Issue 담당자 배정' },
    { key: 'reviewSubmitted', label: 'PR 리뷰 제출' },
    { key: 'commentCreated', label: '코멘트 작성' },
  ];

  function emptyToggles(): GithubEventToggles {
    return {
      pullRequestOpened: false,
      pullRequestUpdated: false,
      pullRequestMerged: false,
      pullRequestAssigned: false,
      issueOpened: false,
      issueAssigned: false,
      reviewSubmitted: false,
      commentCreated: false,
    };
  }

  const settings = ref<GithubNotifySettings>({
    enabled: false,
    channelId: null,
    events: emptyToggles(),
    template: '',
    eventTemplates: {},
    repos: [],
    accounts: [],
  });
  const channels = ref<DiscordChannel[]>([]);
  const deliveries = ref<GithubDelivery[]>([]);
  const members = ref<DiscordMember[]>([]);
  const error = ref('');
  const saved = ref('');
  const loading = ref(true);

  onMounted(async () => {
    try {
      const [loaded, channelBody, memberBody] = await Promise.all([
        fetchJson<GithubNotifySettings>('/api/github-notify'),
        fetchJson<{ channels: DiscordChannel[] }>('/api/discord/channels'),
        fetchJson<{ members: DiscordMember[] }>('/api/discord/members'),
      ]);
      settings.value = {
        ...loaded,
        events: { ...emptyToggles(), ...loaded.events },
        eventTemplates: { ...loaded.eventTemplates },
        repos: loaded.repos ?? [],
        accounts: loaded.accounts ?? [],
      };
      channels.value = channelBody.channels;
      await refreshDeliveries();
      members.value = memberBody.members;
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '설정을 불러오지 못했습니다.';
    } finally {
      loading.value = false;
    }
  });

  function addRepoRow(): void {
    settings.value.repos = [...settings.value.repos, { repo: '', channelId: null, events: null }];
  }

  function removeRepoRow(index: number): void {
    settings.value.repos = settings.value.repos.filter((_, item) => item !== index);
  }

  // WHY: `events: null` means the repository inherits the defaults. Turning the
  // override on seeds it from the current defaults so nothing silently changes.
  function toggleRepoOverride(index: number, on: boolean): void {
    const row = settings.value.repos[index];
    if (!row) {
      return;
    }

    row.events = on ? { ...settings.value.events } : null;
  }

  function addAccountRow(): void {
    settings.value.accounts = [...settings.value.accounts, { githubLogin: '', discordUserId: '' }];
  }

  function removeAccountRow(index: number): void {
    settings.value.accounts = settings.value.accounts.filter((_, item) => item !== index);
  }

  async function refreshDeliveries(): Promise<void> {
    try {
      const body = await fetchJson<{ deliveries: GithubDelivery[] }>(
        '/api/github-notify/deliveries',
      );
      deliveries.value = body.deliveries;
    } catch {
      // A diagnostic panel that fails to load must not block the settings page.
      deliveries.value = [];
    }
  }

  function outcomeVariant(
    outcome: GithubDelivery['outcome'],
  ): 'default' | 'secondary' | 'destructive' {
    if (outcome === 'sent') {
      return 'default';
    }

    return outcome === 'failed' ? 'destructive' : 'secondary';
  }

  function formatTime(at: string): string {
    return new Date(at).toLocaleString();
  }

  // An override the operator emptied means "go back to the default", so blank
  // entries are dropped rather than saved as an empty template.
  function overriddenTemplates(): GithubEventTemplates {
    const result: GithubEventTemplates = {};
    for (const event of eventLabels) {
      const text = settings.value.eventTemplates[event.key]?.trim();
      if (text) {
        result[event.key] = text;
      }
    }

    return result;
  }

  function toggleOverride(key: keyof GithubEventToggles, on: boolean): void {
    if (on) {
      // Seeding with the current default keeps switching the box on from silently
      // changing what gets posted.
      settings.value.eventTemplates[key] = settings.value.template;
      return;
    }

    delete settings.value.eventTemplates[key];
  }

  async function save(): Promise<void> {
    error.value = '';
    saved.value = '';

    // Blank rows are dropped the way incomplete reaction roles are, but a row that
    // was filled in wrongly is reported instead of vanishing on save.
    const repos: GithubRepoRule[] = settings.value.repos
      .map((row) => ({ ...row, repo: row.repo.trim() }))
      .filter((row) => row.repo);
    const badRepo = repos.find((row) => !repoPattern.test(row.repo));
    if (badRepo) {
      error.value = `"${badRepo.repo}" 은(는) owner/name 형식이 아닙니다.`;
      return;
    }

    const accounts: GithubAccountMapping[] = settings.value.accounts
      .map((row) => ({ ...row, githubLogin: row.githubLogin.trim() }))
      .filter((row) => row.githubLogin || row.discordUserId);
    const incomplete = accounts.find((row) => !row.githubLogin || !row.discordUserId);
    if (incomplete) {
      error.value = '모든 매핑에는 GitHub 계정과 디스코드 사용자가 필요합니다.';
      return;
    }

    const badLogin = accounts.find((row) => !loginPattern.test(row.githubLogin));
    if (badLogin) {
      error.value = `"${badLogin.githubLogin}" 은(는) 올바른 GitHub 계정이 아닙니다.`;
      return;
    }

    try {
      const result = await putJson<GithubNotifySettings>('/api/github-notify', {
        enabled: settings.value.enabled,
        channelId: settings.value.channelId,
        events: settings.value.events,
        template: settings.value.template,
        eventTemplates: overriddenTemplates(),
        repos,
        accounts,
      });
      settings.value = {
        ...result,
        events: { ...emptyToggles(), ...result.events },
        eventTemplates: result.eventTemplates ?? {},
        repos: result.repos ?? [],
        accounts: result.accounts ?? [],
      };
      saved.value = '저장했습니다.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '저장하지 못했습니다.';
    }
  }
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader
      title="GitHub 리마인더"
      description="GitHub App이 보낸 PR·이슈 활동을 디스코드 채널로 전달합니다"
    >
      <template #actions>
        <Badge :variant="settings.enabled ? 'default' : 'secondary'">
          {{ settings.enabled ? '활성' : '비활성' }}
        </Badge>
      </template>
    </PageHeader>

    <p v-if="readOnly" class="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm">
      읽기 전용 계정입니다 — 설정을 변경할 수 없습니다.
    </p>

    <StateBlock :loading="loading" :error="loading ? '' : error && !saved ? error : ''">
      <div class="flex flex-col gap-5">
        <Alert v-if="error" variant="destructive">
          <AlertTitle>저장하지 못했습니다</AlertTitle>
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
        <Alert v-else-if="saved">
          <AlertDescription>{{ saved }}</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">알림</CardTitle>
            <CardDescription>
              웹훅 시크릿이 서버에 설정되어 있는 동안에만 이벤트를 받습니다.
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="flex items-center justify-between gap-4">
              <Label for="gh-enabled" class="flex-col items-start gap-1">
                <span>알림 사용</span>
                <span class="text-muted-foreground text-xs font-normal">
                  끄면 모든 저장소의 알림이 즉시 중지됩니다
                </span>
              </Label>
              <Switch id="gh-enabled" v-model="settings.enabled" :disabled="readOnly" />
            </div>
            <Separator />
            <div class="flex flex-col gap-1.5">
              <Label for="gh-channel">기본 채널</Label>
              <ChannelSelect
                id="gh-channel"
                v-model="settings.channelId"
                :channels="channels"
                placeholder="지정 안 함"
                :placeholder-value="null"
                :disabled="readOnly"
              />
              <p class="text-muted-foreground text-xs">
                저장소별 지정이 없으면 이 채널로 보냅니다. 카테고리가 함께 표시되어 이름이 같은
                채널도 구분됩니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">기본 이벤트</CardTitle>
            <CardDescription>
              아래에서 저장소가 따로 지정하지 않는 한 모든 저장소에 적용됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="grid gap-3 sm:grid-cols-2">
              <div v-for="event in eventLabels" :key="event.key" class="flex items-center gap-2.5">
                <Checkbox
                  :id="`ev-${event.key}`"
                  v-model="settings.events[event.key]"
                  :disabled="readOnly"
                />
                <Label :for="`ev-${event.key}`" class="font-normal">{{ event.label }}</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">메시지 템플릿</CardTitle>
            <CardDescription>
              모든 알림이 사용할 기본 문구입니다. 이벤트를 체크하지 않으면 이 기본값을 따릅니다.
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="gh-template">기본 템플릿</Label>
              <Textarea
                id="gh-template"
                v-model="settings.template"
                rows="3"
                class="font-mono"
                :disabled="readOnly"
              />
            </div>

            <details class="bg-muted/40 rounded-lg border px-3 py-2">
              <summary class="text-muted-foreground cursor-pointer text-sm">
                사용 가능한 변수
              </summary>
              <div class="text-muted-foreground mt-3 flex flex-col gap-2 text-sm">
                <p class="font-mono text-xs">
                  <span v-for="name in templateVariables" :key="name" class="mr-2">
                    {{ '{' + name + '}' }}
                  </span>
                </p>
                <p>
                  <code>{name|있을 때|없을 때}</code> 형식으로 값 유무에 따라 문구를 바꿀 수
                  있습니다. 첫 번째 분기는 값 뒤에 붙고, 안에 <code>{}</code> 를 넣으면 그 자리에
                  값이 들어갑니다. 두 번째 분기는 값이 없을 때 전체를 대체합니다.
                </p>
                <p>
                  예 — <code>{reviewers|: requested|updated} by {assignees}</code> 는 리뷰어가
                  있으면 <em>@reviewer: requested by @author</em>, 없으면
                  <em>updated by @author</em> 가 됩니다.
                </p>
              </div>
            </details>

            <div class="flex flex-col gap-3">
              <div v-for="event in eventLabels" :key="event.key" class="flex flex-col gap-1.5">
                <div class="flex items-center gap-2.5">
                  <Checkbox
                    :id="`tpl-${event.key}`"
                    :model-value="settings.eventTemplates[event.key] !== undefined"
                    :disabled="readOnly"
                    @update:model-value="toggleOverride(event.key, $event === true)"
                  />
                  <Label :for="`tpl-${event.key}`" class="font-normal">
                    {{ event.label }} 문구 따로 지정
                  </Label>
                </div>
                <Textarea
                  v-if="settings.eventTemplates[event.key] !== undefined"
                  v-model="settings.eventTemplates[event.key]"
                  rows="2"
                  class="font-mono"
                  :disabled="readOnly"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">저장소</CardTitle>
            <CardDescription
              >여기 없는 저장소는 기본 채널과 기본 이벤트를 사용합니다.</CardDescription
            >
            <CardAction>
              <Button variant="outline" size="sm" :disabled="readOnly" @click="addRepoRow">
                <Plus />
                추가
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent class="flex flex-col gap-3">
            <p v-if="settings.repos.length === 0" class="text-muted-foreground text-sm">
              개별 설정된 저장소가 없습니다.
            </p>
            <div
              v-for="(row, index) in settings.repos"
              :key="`repo-${index}`"
              class="bg-muted/40 flex flex-col gap-3 rounded-lg border p-3"
            >
              <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input v-model="row.repo" :disabled="readOnly" placeholder="owner/name" />
                <ChannelSelect
                  v-model="row.channelId"
                  :channels="channels"
                  placeholder="기본 채널 사용"
                  :placeholder-value="null"
                  :disabled="readOnly"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  :disabled="readOnly"
                  aria-label="저장소 삭제"
                  @click="removeRepoRow(index)"
                >
                  <Trash2 />
                </Button>
              </div>
              <div class="flex items-center gap-2.5">
                <Checkbox
                  :id="`repo-ov-${index}`"
                  :model-value="row.events !== null"
                  :disabled="readOnly"
                  @update:model-value="toggleRepoOverride(index, $event === true)"
                />
                <Label :for="`repo-ov-${index}`" class="font-normal">
                  이 저장소에서 이벤트 따로 지정
                </Label>
              </div>
              <div v-if="row.events" class="grid gap-3 border-t pt-3 sm:grid-cols-2">
                <div
                  v-for="event in eventLabels"
                  :key="event.key"
                  class="flex items-center gap-2.5"
                >
                  <Checkbox
                    :id="`repo-${index}-${event.key}`"
                    v-model="row.events[event.key]"
                    :disabled="readOnly"
                  />
                  <Label :for="`repo-${index}-${event.key}`" class="font-normal">
                    {{ event.label }}
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">계정 매핑</CardTitle>
            <CardDescription>
              연결된 사람은 알림에서 멘션됩니다. 연결되지 않은 GitHub 계정은 일반 텍스트로
              표시됩니다.
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" :disabled="readOnly" @click="addAccountRow">
                <Plus />
                추가
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent class="flex flex-col gap-2">
            <p v-if="settings.accounts.length === 0" class="text-muted-foreground text-sm">
              연결된 계정이 없습니다.
            </p>
            <div
              v-for="(row, index) in settings.accounts"
              :key="`account-${index}`"
              class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
            >
              <Input
                v-model="row.githubLogin"
                :disabled="readOnly"
                placeholder="GitHub 계정"
                class="font-mono"
              />
              <NativeSelect v-model="row.discordUserId" :disabled="readOnly" class="w-full">
                <NativeSelectOption value="">디스코드 사용자</NativeSelectOption>
                <NativeSelectOption v-for="member in members" :key="member.id" :value="member.id">
                  {{ member.name }}
                </NativeSelectOption>
              </NativeSelect>
              <Button
                variant="ghost"
                size="icon"
                :disabled="readOnly"
                aria-label="매핑 삭제"
                @click="removeAccountRow(index)"
              >
                <Trash2 />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">최근 발송</CardTitle>
            <CardDescription>
              봇이 처리한 최근 20건과 그 결과입니다. 봇을 재시작하면 비워집니다.
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" @click="refreshDeliveries">
                <RefreshCw />
                새로고침
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <StateBlock
              :empty="deliveries.length === 0"
              empty-text="아직 없습니다 — 봇이 시작된 뒤 도착한 이벤트가 없습니다."
            >
              <ul class="flex list-none flex-col gap-2 p-0">
                <li
                  v-for="(delivery, index) in deliveries"
                  :key="`${delivery.at}-${index}`"
                  class="bg-muted/40 rounded-lg border px-3 py-2 text-sm"
                >
                  <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <Badge :variant="outcomeVariant(delivery.outcome)" class="shrink-0">
                      {{ delivery.outcome }}
                    </Badge>
                    <span>{{ delivery.event }}</span>
                    <code class="text-muted-foreground font-mono text-xs">{{ delivery.repo }}</code>
                    <span class="text-muted-foreground ml-auto shrink-0 text-xs">
                      {{ formatTime(delivery.at) }}
                    </span>
                  </div>
                  <p v-if="delivery.detail" class="text-muted-foreground mt-1 text-xs">
                    {{ delivery.detail }}
                  </p>
                </li>
              </ul>
            </StateBlock>
          </CardContent>
        </Card>

        <!-- Long forms scroll well past the button, so it rides along at the bottom. -->
        <div
          class="bg-background/85 sticky bottom-0 -mx-1 flex justify-end rounded-t-xl border-t px-1 py-3 backdrop-blur-md"
        >
          <Button :disabled="readOnly" @click="save">저장</Button>
        </div>
      </div>
    </StateBlock>
  </div>
</template>
