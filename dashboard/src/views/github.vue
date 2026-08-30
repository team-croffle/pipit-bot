<script setup lang="ts">
  import { Plus, RefreshCw, Trash2 } from 'lucide-vue-next';
  import { onMounted, ref } from 'vue';

  import { fetchJson, putJson } from '@/api';
  import ChannelSelect from '@/components/common/channel-select.vue';
  import MemberSelect from '@/components/common/member-select.vue';
  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import SuggestInput from '@/components/common/suggest-input.vue';
  import TemplateList from '@/components/github/template-list.vue';
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
  import { Label } from '@/components/ui/label';
  import { Separator } from '@/components/ui/separator';
  import { Switch } from '@/components/ui/switch';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import { eventLabels } from '@/lib/github-templates';
  import type {
    DashboardIdentity,
    DiscordChannel,
    DiscordMember,
    GithubAccountMapping,
    GithubDelivery,
    GithubEventToggles,
    GithubNotifySettings,
    GithubRepoRule,
    GithubTemplateDefaults,
  } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;

  const repoPattern = /^[\w.-]{1,100}\/[\w.-]{1,100}$/;
  const loginPattern = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

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
    eventTemplates: {},
    repos: [],
    accounts: [],
  });
  const templateDefaults = ref<GithubTemplateDefaults | null>(null);
  const channels = ref<DiscordChannel[]>([]);
  const deliveries = ref<GithubDelivery[]>([]);
  const members = ref<DiscordMember[]>([]);
  const membersLoading = ref(false);
  let membersRequested = false;

  /**
   * The guild member list is only filled by a bulk fetch on the bot side, so it is
   * pulled the first time something actually needs it — opening the picker or adding
   * a mapping — instead of on every visit to this page.
   */
  async function loadMembers(): Promise<void> {
    if (membersRequested) {
      return;
    }

    membersRequested = true;
    membersLoading.value = true;
    try {
      const body = await fetchJson<{ members: DiscordMember[] }>('/api/discord/members');
      members.value = body.members;
    } catch {
      // The picker says it has nothing; the rest of the page still works.
      membersRequested = false;
    } finally {
      membersLoading.value = false;
    }
  }
  const repositories = ref<string[]>([]);
  const repositoriesLoading = ref(false);
  let repositoriesRequested = false;

  const githubLogins = ref<string[]>([]);
  const githubLoginsLoading = ref(false);
  let githubLoginsRequested = false;

  /**
   * Both lists come off the GitHub App installation, which is optional — the server
   * answers `available: false` when there are no credentials and the fields stay
   * plain text. Loaded on first use for the same reason as the member list: neither
   * is needed to look at the page.
   */
  async function loadRepositories(): Promise<void> {
    if (repositoriesRequested) {
      return;
    }

    repositoriesRequested = true;
    repositoriesLoading.value = true;
    try {
      const body = await fetchJson<{ available: boolean; repositories: { fullName: string }[] }>(
        '/api/github/repositories',
      );
      repositories.value = body.repositories.map((repository) => repository.fullName);
    } catch {
      repositoriesRequested = false;
    } finally {
      repositoriesLoading.value = false;
    }
  }

  async function loadGithubLogins(): Promise<void> {
    if (githubLoginsRequested) {
      return;
    }

    githubLoginsRequested = true;
    githubLoginsLoading.value = true;
    try {
      const body = await fetchJson<{ available: boolean; members: { login: string }[] }>(
        '/api/github/members',
      );
      githubLogins.value = body.members.map((member) => member.login);
    } catch {
      githubLoginsRequested = false;
    } finally {
      githubLoginsLoading.value = false;
    }
  }

  const error = ref('');
  const saved = ref('');
  const loading = ref(true);

  onMounted(async () => {
    try {
      const [loaded, channelBody, defaultsBody] = await Promise.all([
        fetchJson<GithubNotifySettings>('/api/github-notify'),
        fetchJson<{ channels: DiscordChannel[] }>('/api/discord/channels'),
        fetchJson<GithubTemplateDefaults>('/api/github-notify/defaults'),
      ]);
      settings.value = {
        ...loaded,
        events: { ...emptyToggles(), ...loaded.events },
        eventTemplates: { ...loaded.eventTemplates },
        repos: loaded.repos ?? [],
        accounts: loaded.accounts ?? [],
      };
      templateDefaults.value = defaultsBody;
      channels.value = channelBody.channels;
      await refreshDeliveries();
      // Existing mappings only store an id, so the names behind them are fetched
      // after the page is up rather than holding it back.
      if (settings.value.accounts.length > 0) {
        void loadMembers();
      }
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '설정을 불러오지 못했습니다.';
    } finally {
      loading.value = false;
    }
  });

  const openRepos = ref(new Set<number>());

  function toggleOpen(index: number): void {
    void loadRepositories();
    const next = new Set(openRepos.value);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    openRepos.value = next;
  }

  function addRepoRow(): void {
    settings.value.repos = [...settings.value.repos, { repo: '', channelId: null, events: null }];
    // A row added from the table header would otherwise be an unexplained blank line.
    toggleOpen(settings.value.repos.length - 1);
  }

  function removeRepoRow(index: number): void {
    settings.value.repos = settings.value.repos.filter((_, item) => item !== index);
    openRepos.value = new Set();
  }

  function channelLabel(channelId: string | null): string {
    if (!channelId) {
      return '기본 채널 사용';
    }

    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) {
      return '알 수 없는 채널';
    }

    return `${channel.category ?? '카테고리 없음'} · #${channel.name}`;
  }

  function eventSummary(row: GithubRepoRule): string {
    if (!row.events) {
      return '기본값 사용';
    }

    const on = eventLabels.filter((event) => row.events?.[event.key]);
    if (on.length === 0) {
      return '알림 없음';
    }
    if (on.length === eventLabels.length) {
      return '전체 이벤트';
    }
    if (on.length === 1) {
      return `${on[0]?.label}만`;
    }

    return `${on.length}개 이벤트`;
  }

  function setRepoEvent(index: number, key: keyof GithubEventToggles, on: boolean): void {
    const events = settings.value.repos[index]?.events;
    if (events) {
      events[key] = on;
    }
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
    void loadMembers();
    void loadGithubLogins();
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
        eventTemplates: settings.value.eventTemplates,
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
                :empty-value="null"
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
            <CardTitle class="text-base">알림 문구</CardTitle>
            <CardDescription>
              이벤트마다 보낼 임베드를 지정합니다. 손대지 않은 이벤트는 기본 문구를 씁니다 · 행을
              편집해서 문구와 사용 가능한 변수를 확인하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateList
              :templates="settings.eventTemplates"
              :defaults="templateDefaults"
              :read-only="readOnly"
              @update:templates="settings.eventTemplates = $event"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">저장소별 설정</CardTitle>
            <CardDescription>
              저장소마다 알림 채널과 이벤트 종류를 다르게 지정할 수 있습니다 · 행을 펼쳐서 편집 ·
              GitHub App이 설치된 저장소가 후보로 제시됩니다
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" :disabled="readOnly" @click="addRepoRow">
                <Plus />
                저장소 추가
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p v-if="settings.repos.length === 0" class="text-muted-foreground text-sm">
              개별 설정된 저장소가 없습니다. 모든 저장소가 기본 채널과 기본 이벤트를 사용합니다.
            </p>
            <div v-else class="overflow-x-auto">
              <Table class="min-w-160">
                <TableHeader>
                  <TableRow>
                    <TableHead>저장소</TableHead>
                    <TableHead class="w-56">채널</TableHead>
                    <TableHead class="w-56">이벤트</TableHead>
                    <TableHead class="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <template v-for="(row, index) in settings.repos" :key="`repo-${index}`">
                    <TableRow>
                      <TableCell class="font-gothic font-medium">
                        {{ row.repo || '(이름 없음)' }}
                      </TableCell>
                      <TableCell>{{ channelLabel(row.channelId) }}</TableCell>
                      <TableCell>
                        {{ eventSummary(row) }}
                        <Badge v-if="row.events" variant="secondary" class="ml-1.5">override</Badge>
                      </TableCell>
                      <TableCell class="text-right">
                        <Button variant="outline" size="sm" @click="toggleOpen(index)">
                          {{ openRepos.has(index) ? '접기' : '편집' }}
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow v-if="openRepos.has(index)" class="bg-muted/40 hover:bg-muted/40">
                      <TableCell colspan="4" class="p-4">
                        <div class="flex flex-col gap-4">
                          <div class="grid gap-3 sm:grid-cols-2">
                            <div class="flex flex-col gap-1.5">
                              <Label :for="`repo-name-${index}`">저장소</Label>
                              <SuggestInput
                                :id="`repo-name-${index}`"
                                v-model="row.repo"
                                :options="repositories"
                                :list-id="`repo-options-${index}`"
                                :loading="repositoriesLoading"
                                :disabled="readOnly"
                                placeholder="owner/name"
                                @open="loadRepositories"
                              />
                            </div>
                            <div class="flex flex-col gap-1.5">
                              <Label :for="`repo-channel-${index}`">채널</Label>
                              <ChannelSelect
                                :id="`repo-channel-${index}`"
                                v-model="row.channelId"
                                :channels="channels"
                                placeholder="기본 채널 사용"
                                :empty-value="null"
                                :disabled="readOnly"
                              />
                            </div>
                          </div>

                          <div class="flex items-center justify-between gap-4 border-t pt-4">
                            <Label :for="`repo-ov-${index}`" class="flex-col items-start gap-1">
                              <span>이 저장소에서 이벤트 재정의</span>
                              <span class="text-muted-foreground text-xs font-normal">
                                끄면 기본 알림 이벤트를 그대로 따릅니다
                              </span>
                            </Label>
                            <Switch
                              :id="`repo-ov-${index}`"
                              :model-value="row.events !== null"
                              :disabled="readOnly"
                              @update:model-value="toggleRepoOverride(index, $event === true)"
                            />
                          </div>

                          <div
                            class="grid gap-3 sm:grid-cols-2"
                            :class="row.events ? '' : 'pointer-events-none opacity-40'"
                          >
                            <div
                              v-for="event in eventLabels"
                              :key="event.key"
                              class="flex items-center gap-2.5"
                            >
                              <Checkbox
                                :id="`repo-${index}-${event.key}`"
                                :model-value="
                                  row.events ? row.events[event.key] : settings.events[event.key]
                                "
                                :disabled="readOnly || !row.events"
                                @update:model-value="
                                  setRepoEvent(index, event.key, $event === true)
                                "
                              />
                              <Label :for="`repo-${index}-${event.key}`" class="font-normal">
                                {{ event.label }}
                              </Label>
                            </div>
                          </div>

                          <div class="flex justify-end border-t pt-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              class="text-destructive hover:text-destructive"
                              :disabled="readOnly"
                              @click="removeRepoRow(index)"
                            >
                              <Trash2 />
                              저장소 삭제
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </template>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">계정 매핑</CardTitle>
            <CardDescription>
              연결한 멤버는 담당자 배정·리뷰 요청 알림에서 멘션됩니다. 연결되지 않은 GitHub 계정은
              일반 텍스트로 표시됩니다. GitHub App 자격증명이 설정되어 있으면 조직 멤버가 후보로
              제시되고, 없으면 직접 입력합니다.
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" :disabled="readOnly" @click="addAccountRow">
                <Plus />
                매핑 추가
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
              <MemberSelect
                v-model="row.discordUserId"
                :members="members"
                :loading="membersLoading"
                :disabled="readOnly"
                @open="loadMembers"
              />
              <SuggestInput
                v-model="row.githubLogin"
                :options="githubLogins"
                :list-id="`account-options-${index}`"
                :loading="githubLoginsLoading"
                :disabled="readOnly"
                placeholder="GitHub 계정"
                @open="loadGithubLogins"
              />
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
                    <code class="text-muted-foreground font-gothic text-xs">{{
                      delivery.repo
                    }}</code>
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
          class="bg-background sticky bottom-0 -mx-1 flex justify-end rounded-t-xl border-t px-1 py-3 backdrop-blur-md"
        >
          <Button :disabled="readOnly" @click="save">저장</Button>
        </div>
      </div>
    </StateBlock>
  </div>
</template>
