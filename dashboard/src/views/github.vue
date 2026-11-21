<script setup lang="ts">
  import { ChevronDown, ChevronUp, Plus, RefreshCw, Trash2 } from 'lucide-vue-next';
  import { computed, onMounted, ref } from 'vue';
  import { I18nT, useI18n } from 'vue-i18n';
  import { RouterLink } from 'vue-router';

  import { fetchJson, putJson } from '@/api';
  import ChannelSelect from '@/components/common/channel-select.vue';
  import FeatureLanguageSelect from '@/components/common/feature-language-select.vue';
  import MemberSelect from '@/components/common/member-select.vue';
  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import AccountSelect from '@/components/github/account-select.vue';
  import RemindCard from '@/components/github/remind-card.vue';
  import RepoRuleRow from '@/components/github/repo-rule-row.vue';
  import TeamMappings from '@/components/github/team-mappings.vue';
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
  import { intlLocale } from '@/i18n';
  import { prepareTeamMappings } from '@/lib/github-teams';
  import { emptyToggles, eventGroups, eventLabels } from '@/lib/github-templates';
  import type {
    DashboardIdentity,
    DiscordChannel,
    DiscordMember,
    GithubAccountMapping,
    GithubDelivery,
    GithubMember,
    GithubMemberList,
    GithubNotifySettings,
    GithubRepoRule,
    GithubTemplateDefaults,
  } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;
  const { t } = useI18n();

  const repoPattern = /^[\w.-]{1,100}\/[\w.-]{1,100}$/;
  const loginPattern = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

  const settings = ref<GithubNotifySettings>({
    enabled: false,
    notifyUnlistedRepos: true,
    channelId: null,
    events: emptyToggles(),
    eventTemplates: {},
    repos: [],
    accounts: [],
    teams: [],
  });
  const templateDefaults = ref<GithubTemplateDefaults | null>(null);

  // Collapsed by default: most visits here are about a channel or a repository.
  const wordingOpen = ref(false);
  const overriddenCount = computed(() => Object.keys(settings.value.eventTemplates).length);
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

  const githubMembers = ref<GithubMember[]>([]);
  const githubMembersLoading = ref(false);
  const githubMembersInfo = ref<GithubMemberList | null>(null);
  let githubMembersRequested = false;

  /**
   * Why the account list is what it is. An empty dropdown used to be the only signal
   * for three different situations, and the operator could act on none of them.
   */
  const githubMembersNote = computed(() => {
    const info = githubMembersInfo.value;
    if (!info) {
      return '';
    }

    if (!info.available) {
      return info.reason === 'no-credentials'
        ? t('github.accounts.noCredentials')
        : t('github.accounts.fetchFailed');
    }

    if (info.source === 'assignees') {
      return t('github.accounts.assignees');
    }

    if (info.source === 'none') {
      return t('github.accounts.none');
    }

    return '';
  });

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

  async function loadGithubMembers(): Promise<void> {
    if (githubMembersRequested) {
      return;
    }

    githubMembersRequested = true;
    githubMembersLoading.value = true;
    try {
      const body = await fetchJson<GithubMemberList>('/api/github/members');
      githubMembers.value = body.members;
      githubMembersInfo.value = body;
    } catch {
      githubMembersRequested = false;
      // Same note as a failure the server reports, so the row is not left unexplained.
      githubMembersInfo.value = { available: false, members: [], reason: 'request-failed' };
    } finally {
      githubMembersLoading.value = false;
    }
  }

  const error = ref('');
  const saved = ref('');
  const loading = ref(true);
  /** The server could not read its file and is running on defaults. */
  const loadError = ref('');
  /**
   * The page itself could not be fetched. Kept apart from `error` — a rejected save
   * has to show above the form, not replace it, or the row cannot be fixed.
   */
  const loadFailed = ref('');

  onMounted(async () => {
    try {
      const [loaded, accountBody, channelBody, defaultsBody] = await Promise.all([
        fetchJson<GithubNotifySettings>('/api/github-notify'),
        fetchJson<{ accounts: GithubAccountMapping[] }>('/api/accounts'),
        fetchJson<{ channels: DiscordChannel[] }>('/api/discord/channels'),
        fetchJson<GithubTemplateDefaults>('/api/github-notify/defaults'),
      ]);
      settings.value = {
        ...loaded,
        // Same rule as the server: only an explicit false turns the fallback off.
        notifyUnlistedRepos: loaded.notifyUnlistedRepos !== false,
        events: { ...emptyToggles(), ...loaded.events },
        eventTemplates: { ...loaded.eventTemplates },
        repos: loaded.repos ?? [],
        accounts: accountBody.accounts ?? [],
        teams: loaded.teams ?? [],
      };
      loadError.value = loaded.loadError ?? '';
      templateDefaults.value = defaultsBody;
      channels.value = channelBody.channels;
      await refreshDeliveries();
      // Existing mappings only store an id and a login, so the names and avatars
      // behind both halves are fetched after the page is up rather than holding it
      // back — the pair renders alike instead of one half waiting for a click.
      if (settings.value.accounts.length > 0) {
        void loadMembers();
        void loadGithubMembers();
      }
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      loadFailed.value = cause instanceof Error ? cause.message : t('github.loadFailed');
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
      return t('github.repos.useDefaultChannel');
    }

    const channel = channels.value.find((item) => item.id === channelId);
    if (!channel) {
      return t('github.repos.unknownChannel');
    }

    return `${channel.category ?? t('github.repos.noCategory')} · #${channel.name}`;
  }

  function eventSummary(row: GithubRepoRule): string {
    if (!row.events) {
      return t('github.summary.defaults');
    }

    const on = eventLabels.filter((event) => row.events?.[event.key]);
    if (on.length === 0) {
      return t('github.summary.none');
    }
    if (on.length === eventLabels.length) {
      return t('github.summary.all');
    }
    if (on.length === 1) {
      return t('github.summary.only', { label: on[0]?.label ?? '' });
    }

    return t('github.summary.count', { count: on.length }, on.length);
  }

  function setRepoRow(index: number, rule: GithubRepoRule): void {
    settings.value.repos = settings.value.repos.map((row, item) => (item === index ? rule : row));
  }

  function addAccountRow(): void {
    void loadMembers();
    void loadGithubMembers();
    settings.value.accounts = [...settings.value.accounts, { githubLogin: '', discordUserId: '' }];
  }

  function removeAccountRow(index: number): void {
    settings.value.accounts = settings.value.accounts.filter((_, item) => item !== index);
  }

  function addTeamRow(): void {
    settings.value.teams = [...settings.value.teams, { githubTeam: '', discordRoleId: '' }];
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
  ): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (outcome === 'sent') {
      return 'default';
    }

    if (outcome === 'edited') {
      return 'outline';
    }

    return outcome === 'failed' ? 'destructive' : 'secondary';
  }

  function formatTime(at: string): string {
    return new Date(at).toLocaleString(intlLocale());
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
      error.value = t('github.errors.repoFormat', { repo: badRepo.repo });
      return;
    }

    const accounts: GithubAccountMapping[] = settings.value.accounts
      .map((row) => ({ ...row, githubLogin: row.githubLogin.trim() }))
      .filter((row) => row.githubLogin || row.discordUserId);
    const incomplete = accounts.find((row) => !row.githubLogin || !row.discordUserId);
    if (incomplete) {
      error.value = t('github.errors.accountIncomplete');
      return;
    }

    const badLogin = accounts.find((row) => !loginPattern.test(row.githubLogin));
    if (badLogin) {
      error.value = t('github.errors.loginInvalid', { login: badLogin.githubLogin });
      return;
    }

    const prepared = prepareTeamMappings(settings.value.teams);
    if (prepared.error) {
      error.value = prepared.error;
      return;
    }

    let result: GithubNotifySettings;
    try {
      result = await putJson<GithubNotifySettings>('/api/github-notify', {
        enabled: settings.value.enabled,
        notifyUnlistedRepos: settings.value.notifyUnlistedRepos,
        channelId: settings.value.channelId,
        events: settings.value.events,
        eventTemplates: settings.value.eventTemplates,
        repos,
        teams: prepared.teams,
      });
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : t('github.saveFailed');
      return;
    }

    // The account links are their own store since v0.8.0 — a second request, and a
    // failure there must not read as if nothing was saved.
    let linked = accounts;
    try {
      linked = (await putJson<{ accounts: GithubAccountMapping[] }>('/api/accounts', { accounts }))
        .accounts;
    } catch (cause) {
      error.value = t('github.accountsSaveFailed', {
        reason: cause instanceof Error ? cause.message : t('github.unknownError'),
      });
    }

    settings.value = {
      ...result,
      notifyUnlistedRepos: result.notifyUnlistedRepos !== false,
      events: { ...emptyToggles(), ...result.events },
      eventTemplates: result.eventTemplates ?? {},
      repos: result.repos ?? [],
      accounts: linked,
      teams: result.teams ?? [],
    };
    if (!error.value) {
      saved.value = t('github.saved');
    }
    loadError.value = '';
  }
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader :title="t('github.title')" :description="t('github.description')">
      <template #actions>
        <FeatureLanguageSelect feature="github" :read-only="readOnly" />
        <Badge :variant="settings.enabled ? 'default' : 'secondary'">
          {{ settings.enabled ? t('github.active') : t('github.inactive') }}
        </Badge>
      </template>
    </PageHeader>

    <p v-if="readOnly" class="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm">
      {{ t('github.readOnly') }}
    </p>

    <StateBlock :loading="loading" :error="loadFailed">
      <div class="flex flex-col gap-5">
        <Alert v-if="loadError" variant="destructive">
          <AlertTitle>{{ t('github.fileUnreadTitle') }}</AlertTitle>
          <AlertDescription> {{ t('github.fileUnreadBody') }} {{ loadError }} </AlertDescription>
        </Alert>
        <Alert v-if="error" variant="destructive">
          <AlertTitle>{{ t('github.saveFailedTitle') }}</AlertTitle>
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
        <Alert v-else-if="saved">
          <AlertDescription>{{ saved }}</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ t('github.notify.title') }}</CardTitle>
            <CardDescription>{{ t('github.notify.description') }}</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="flex items-center justify-between gap-4">
              <Label for="gh-enabled" class="flex-col items-start gap-1">
                <span>{{ t('github.notify.enabled') }}</span>
                <span class="text-muted-foreground text-xs font-normal">
                  {{ t('github.notify.enabledHint') }}
                </span>
              </Label>
              <Switch id="gh-enabled" v-model="settings.enabled" :disabled="readOnly" />
            </div>
            <div class="flex items-center justify-between gap-4">
              <Label for="gh-unlisted" class="flex-col items-start gap-1">
                <span>{{ t('github.notify.unlisted') }}</span>
                <span class="text-muted-foreground text-xs font-normal">
                  {{ t('github.notify.unlistedHint') }}
                </span>
              </Label>
              <Switch
                id="gh-unlisted"
                v-model="settings.notifyUnlistedRepos"
                :disabled="readOnly"
              />
            </div>
            <Separator />
            <div class="flex flex-col gap-1.5">
              <Label for="gh-channel">{{ t('github.notify.channel') }}</Label>
              <ChannelSelect
                id="gh-channel"
                v-model="settings.channelId"
                :channels="channels"
                :placeholder="t('github.notify.channelNone')"
                :empty-value="null"
                :disabled="readOnly"
              />
              <p class="text-muted-foreground text-xs">
                {{ t('github.notify.channelHint') }}
              </p>
            </div>
          </CardContent>
        </Card>

        <RemindCard
          :read-only="readOnly"
          :enabled="settings.enabled"
          :repositories="repositories"
          :repositories-loading="repositoriesLoading"
          :channels="channels"
          @open="loadRepositories"
          @reminded="refreshDeliveries"
        />

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ t('github.defaultEvents.title') }}</CardTitle>
            <CardDescription>{{ t('github.defaultEvents.description') }}</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex flex-col gap-4">
              <div v-for="group in eventGroups" :key="group.key" class="flex flex-col gap-2">
                <p class="text-muted-foreground text-xs font-medium">{{ group.name }}</p>
                <div class="grid gap-3 sm:grid-cols-2">
                  <div
                    v-for="event in group.events"
                    :key="event.key"
                    class="flex items-center gap-2.5"
                  >
                    <Checkbox
                      :id="`ev-${event.key}`"
                      v-model="settings.events[event.key]"
                      :disabled="readOnly"
                    />
                    <Label :for="`ev-${event.key}`" class="font-normal">{{ event.label }}</Label>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Twelve rows is a lot of page to scroll past when you came here for a
             channel, so the section folds. -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ t('github.wording.title') }}</CardTitle>
            <CardDescription>{{ t('github.wording.description') }}</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" @click="wordingOpen = !wordingOpen">
                <ChevronDown v-if="!wordingOpen" />
                <ChevronUp v-else />
                {{ wordingOpen ? t('github.collapse') : t('github.expand') }}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent v-if="wordingOpen">
            <TemplateList
              :templates="settings.eventTemplates"
              :defaults="templateDefaults"
              :read-only="readOnly"
              @update:templates="settings.eventTemplates = $event"
            />
          </CardContent>
          <CardContent v-else>
            <p class="text-muted-foreground text-sm">
              {{ t('github.wording.overridden', { count: overriddenCount }, overriddenCount) }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ t('github.repos.title') }}</CardTitle>
            <CardDescription>{{ t('github.repos.description') }}</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" :disabled="readOnly" @click="addRepoRow">
                <Plus />
                {{ t('github.repos.add') }}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p v-if="settings.repos.length === 0" class="text-muted-foreground text-sm">
              {{ t('github.repos.empty') }}
            </p>
            <!-- Below md the channel and event columns fold into the repository cell and
                 the table drops its minimum width, so the expanded editor (one cell
                 spanning the row) is as wide as the card instead of scrolling sideways. -->
            <div v-else class="overflow-x-auto">
              <Table class="md:min-w-160">
                <TableHeader>
                  <TableRow>
                    <TableHead>{{ t('github.repos.repo') }}</TableHead>
                    <TableHead class="hidden w-56 md:table-cell">{{
                      t('github.repos.channel')
                    }}</TableHead>
                    <TableHead class="hidden w-56 md:table-cell">{{
                      t('github.repos.events')
                    }}</TableHead>
                    <TableHead class="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <template v-for="(row, index) in settings.repos" :key="`repo-${index}`">
                    <TableRow>
                      <TableCell class="whitespace-normal md:whitespace-nowrap">
                        <span class="font-gothic font-medium break-all">
                          {{ row.repo || t('github.repos.unnamed') }}
                        </span>
                        <span class="text-muted-foreground mt-0.5 block text-xs md:hidden">
                          {{ channelLabel(row.channelId) }} · {{ eventSummary(row) }}
                          <Badge v-if="row.events" variant="secondary" class="ml-1">override</Badge>
                        </span>
                      </TableCell>
                      <TableCell class="hidden md:table-cell">
                        {{ channelLabel(row.channelId) }}
                      </TableCell>
                      <TableCell class="hidden md:table-cell">
                        {{ eventSummary(row) }}
                        <Badge v-if="row.events" variant="secondary" class="ml-1.5">override</Badge>
                      </TableCell>
                      <TableCell class="text-right">
                        <Button variant="outline" size="sm" @click="toggleOpen(index)">
                          {{ openRepos.has(index) ? t('github.collapse') : t('github.edit') }}
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow v-if="openRepos.has(index)" class="bg-muted/40 hover:bg-muted/40">
                      <TableCell colspan="4" class="p-4 whitespace-normal">
                        <RepoRuleRow
                          :model-value="row"
                          :channels="channels"
                          :repositories="repositories"
                          :repositories-loading="repositoriesLoading"
                          :default-events="settings.events"
                          :read-only="readOnly"
                          :id-prefix="`repo-${index}`"
                          @update:model-value="setRepoRow(index, $event)"
                          @remove="removeRepoRow(index)"
                          @open-repositories="loadRepositories"
                        />
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
            <CardTitle class="text-base">{{ t('github.accounts.title') }}</CardTitle>
            <CardDescription>
              <I18nT keypath="github.accounts.description" scope="global">
                <template #users>
                  <RouterLink to="/users" class="underline underline-offset-2">{{
                    t('github.accounts.usersLink')
                  }}</RouterLink>
                </template>
              </I18nT>
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" :disabled="readOnly" @click="addAccountRow">
                <Plus />
                {{ t('github.accounts.add') }}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent class="flex flex-col gap-2">
            <p v-if="settings.accounts.length === 0" class="text-muted-foreground text-sm">
              {{ t('github.accounts.empty') }}
            </p>
            <div
              v-for="(row, index) in settings.accounts"
              :key="`account-${index}`"
              class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start"
              data-account-row
            >
              <MemberSelect
                v-model="row.discordUserId"
                :members="members"
                :loading="membersLoading"
                :disabled="readOnly"
                @open="loadMembers"
              />
              <AccountSelect
                v-model="row.githubLogin"
                :members="githubMembers"
                :loading="githubMembersLoading"
                :disabled="readOnly"
                @open="loadGithubMembers"
              />
              <Button
                variant="ghost"
                size="icon"
                :disabled="readOnly"
                :aria-label="t('github.accounts.remove')"
                @click="removeAccountRow(index)"
              >
                <Trash2 />
              </Button>
            </div>
            <p v-if="githubMembersNote" class="text-muted-foreground text-xs">
              {{ githubMembersNote }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ t('github.teams.title') }}</CardTitle>
            <CardDescription>{{ t('github.teams.description') }}</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" :disabled="readOnly" @click="addTeamRow">
                <Plus />
                {{ t('github.teams.add') }}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <TeamMappings v-model="settings.teams" :read-only="readOnly" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ t('github.deliveries.title') }}</CardTitle>
            <CardDescription>{{ t('github.deliveries.description') }}</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" @click="refreshDeliveries">
                <RefreshCw />
                {{ t('github.deliveries.refresh') }}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <StateBlock :empty="deliveries.length === 0" :empty-text="t('github.deliveries.empty')">
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
          <Button :disabled="readOnly" @click="save">{{ t('github.save') }}</Button>
        </div>
      </div>
    </StateBlock>
  </div>
</template>
