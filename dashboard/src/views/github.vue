<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';

  import { fetchJson, putJson } from '../api';
  import { groupChannels } from '../channels';
  import type {
    DashboardIdentity,
    DiscordChannel,
    DiscordMember,
    GithubAccountMapping,
    GithubEventTemplates,
    GithubEventToggles,
    GithubNotifySettings,
    GithubRepoRule,
  } from '../types';

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
    { key: 'pullRequestOpened', label: 'PR opened' },
    { key: 'pullRequestUpdated', label: 'PR updated (new commits)' },
    { key: 'pullRequestMerged', label: 'PR merged' },
    { key: 'pullRequestAssigned', label: 'PR assigned / review requested' },
    { key: 'issueOpened', label: 'Issue opened' },
    { key: 'issueAssigned', label: 'Issue assigned' },
    { key: 'reviewSubmitted', label: 'Review submitted' },
    { key: 'commentCreated', label: 'Comment created' },
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
  const channelGroups = computed(() => groupChannels(channels.value));
  const members = ref<DiscordMember[]>([]);
  const error = ref('');
  const saved = ref('');
  const loading = ref(true);

  const fieldClass =
    'w-full rounded-xl border border-line bg-bg-elevated px-3 py-2.5 text-sm text-text outline-none transition focus:border-accent';
  const labelClass = 'mb-1.5 block text-sm font-medium text-text';
  const ghostBtnClass =
    'rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-muted transition hover:border-line hover:bg-panel-hover hover:text-text disabled:opacity-55';
  const cardClass =
    'rounded-2xl border border-line-soft bg-panel p-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)] sm:p-5';

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
      members.value = memberBody.members;
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : 'Failed to load settings';
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
  function toggleRepoOverride(index: number): void {
    const row = settings.value.repos[index];
    if (!row) {
      return;
    }

    row.events = row.events ? null : { ...settings.value.events };
  }

  function addAccountRow(): void {
    settings.value.accounts = [...settings.value.accounts, { githubLogin: '', discordUserId: '' }];
  }

  function removeAccountRow(index: number): void {
    settings.value.accounts = settings.value.accounts.filter((_, item) => item !== index);
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
      error.value = `"${badRepo.repo}" is not in owner/name form.`;
      return;
    }

    const accounts: GithubAccountMapping[] = settings.value.accounts
      .map((row) => ({ ...row, githubLogin: row.githubLogin.trim() }))
      .filter((row) => row.githubLogin || row.discordUserId);
    const incomplete = accounts.find((row) => !row.githubLogin || !row.discordUserId);
    if (incomplete) {
      error.value = 'Every mapping needs a GitHub login and a Discord user.';
      return;
    }

    const badLogin = accounts.find((row) => !loginPattern.test(row.githubLogin));
    if (badLogin) {
      error.value = `"${badLogin.githubLogin}" is not a valid GitHub login.`;
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
      saved.value = 'Saved.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Failed to save';
    }
  }
</script>

<template>
  <div class="flex flex-col gap-4">
    <p
      v-if="readOnly"
      class="rounded-xl border border-line-soft bg-readonly px-4 py-3 text-sm text-muted"
    >
      View only — settings cannot be changed.
    </p>
    <p v-if="error" class="text-sm text-bad">{{ error }}</p>
    <p v-if="saved" class="text-sm text-muted">{{ saved }}</p>
    <p v-if="loading" class="text-sm text-muted">Loading…</p>

    <section v-if="!loading" :class="cardClass">
      <h2 class="mb-3 mt-0 text-base font-semibold">Notifications</h2>
      <p class="mb-4 text-sm text-muted">
        Pull request and issue activity from the GitHub App is posted to Discord. Deliveries are
        only accepted while the webhook secret is configured on the server.
      </p>
      <label class="mb-4 flex items-center gap-2 text-sm">
        <input
          v-model="settings.enabled"
          type="checkbox"
          class="accent-accent"
          :disabled="readOnly"
        />
        Enable notifications
      </label>
      <div>
        <label for="gh-channel" :class="labelClass">Default channel</label>
        <select
          id="gh-channel"
          v-model="settings.channelId"
          :class="fieldClass"
          :disabled="readOnly"
        >
          <option :value="null">Not set</option>
          <optgroup v-for="group in channelGroups" :key="group.category" :label="group.category">
            <option v-for="channel in group.channels" :key="channel.id" :value="channel.id">
              {{ channel.name }}
            </option>
          </optgroup>
        </select>
      </div>
    </section>

    <section v-if="!loading" :class="cardClass">
      <h2 class="mb-3 mt-0 text-base font-semibold">Default events</h2>
      <p class="mb-4 text-sm text-muted">
        Applies to every watched repository unless the repository overrides it below.
      </p>
      <div class="flex flex-wrap gap-3">
        <label
          v-for="event in eventLabels"
          :key="event.key"
          class="flex items-center gap-2 text-sm"
        >
          <input
            v-model="settings.events[event.key]"
            type="checkbox"
            class="accent-accent"
            :disabled="readOnly"
          />
          {{ event.label }}
        </label>
      </div>
    </section>

    <section v-if="!loading" :class="cardClass">
      <h2 class="mb-3 mt-0 text-base font-semibold">Message template</h2>
      <p class="mb-4 text-sm text-muted">
        The wording every notification uses. Leave an event unchecked to follow this default.
      </p>

      <div class="mb-4">
        <label for="gh-template" :class="labelClass">Default template</label>
        <textarea
          id="gh-template"
          v-model="settings.template"
          rows="3"
          :class="[fieldClass, 'font-mono leading-relaxed']"
          :disabled="readOnly"
        ></textarea>
      </div>

      <details class="mb-4 rounded-xl border border-line-soft bg-bg-elevated px-3 py-2">
        <summary class="cursor-pointer text-sm text-muted">Variables</summary>
        <div class="mt-3 flex flex-col gap-2 text-sm text-muted">
          <p class="m-0">
            <code v-for="name in templateVariables" :key="name" class="mr-2">{{
              '{' + name + '}'
            }}</code>
          </p>
          <p class="m-0">
            Write <code>{name|when set|when empty}</code> to change the wording depending on whether
            a value exists. The first branch is appended after the value; put <code>{}</code> in it
            to place the value somewhere else. The second branch replaces the whole thing when the
            value is empty.
          </p>
          <p class="m-0">
            Example — <code>{reviewers|: requested|updated} by {assignees}</code> reads
            <em>@reviewer: requested by @author</em> with a reviewer, and
            <em>updated by @author</em> without one.
          </p>
        </div>
      </details>

      <div class="flex flex-col gap-3">
        <div v-for="event in eventLabels" :key="event.key" class="flex flex-col gap-1.5">
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="accent-accent"
              :checked="settings.eventTemplates[event.key] !== undefined"
              :disabled="readOnly"
              @change="toggleOverride(event.key, ($event.target as HTMLInputElement).checked)"
            />
            Custom wording for {{ event.label }}
          </label>
          <textarea
            v-if="settings.eventTemplates[event.key] !== undefined"
            v-model="settings.eventTemplates[event.key]"
            rows="2"
            :class="[fieldClass, 'font-mono leading-relaxed']"
            :disabled="readOnly"
          ></textarea>
        </div>
      </div>
    </section>

    <section v-if="!loading" :class="cardClass">
      <h2 class="mb-3 mt-0 text-base font-semibold">Repositories</h2>
      <p class="mb-4 text-sm text-muted">
        Repositories not listed here use the default channel and events. Listing one lets it post
        somewhere else, or report a different set of events.
      </p>
      <div
        v-for="(row, index) in settings.repos"
        :key="`repo-${index}`"
        class="mb-3 rounded-xl border border-line-soft bg-bg-elevated p-3"
      >
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]">
          <input
            v-model="row.repo"
            :class="fieldClass"
            :disabled="readOnly"
            placeholder="owner/name"
          />
          <select v-model="row.channelId" :class="fieldClass" :disabled="readOnly">
            <option :value="null">Default channel</option>
            <optgroup v-for="group in channelGroups" :key="group.category" :label="group.category">
              <option v-for="channel in group.channels" :key="channel.id" :value="channel.id">
                {{ channel.name }}
              </option>
            </optgroup>
          </select>
          <label class="flex items-center gap-2 whitespace-nowrap text-sm">
            <input
              type="checkbox"
              class="accent-accent"
              :checked="row.events === null"
              :disabled="readOnly"
              @change="toggleRepoOverride(index)"
            />
            Default events
          </label>
          <button
            :class="ghostBtnClass"
            type="button"
            :disabled="readOnly"
            @click="removeRepoRow(index)"
          >
            Remove
          </button>
        </div>
        <div v-if="row.events" class="mt-3 flex flex-wrap gap-3 border-t border-line-soft pt-3">
          <label
            v-for="event in eventLabels"
            :key="event.key"
            class="flex items-center gap-2 text-sm"
          >
            <input
              v-model="row.events[event.key]"
              type="checkbox"
              class="accent-accent"
              :disabled="readOnly"
            />
            {{ event.label }}
          </label>
        </div>
      </div>
      <button :class="ghostBtnClass" type="button" :disabled="readOnly" @click="addRepoRow">
        Add repository
      </button>
    </section>

    <section v-if="!loading" :class="cardClass">
      <h2 class="mb-3 mt-0 text-base font-semibold">Account mapping</h2>
      <p class="mb-4 text-sm text-muted">
        Mapped people are mentioned in the notification. Unmapped GitHub logins appear as plain
        text.
      </p>
      <div
        v-for="(row, index) in settings.accounts"
        :key="`account-${index}`"
        class="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"
      >
        <input
          v-model="row.githubLogin"
          :class="fieldClass"
          :disabled="readOnly"
          placeholder="GitHub login"
        />
        <select v-model="row.discordUserId" :class="fieldClass" :disabled="readOnly">
          <option value="">Discord user</option>
          <option v-for="member in members" :key="member.id" :value="member.id">
            {{ member.name }}
          </option>
        </select>
        <button
          :class="ghostBtnClass"
          type="button"
          :disabled="readOnly"
          @click="removeAccountRow(index)"
        >
          Remove
        </button>
      </div>
      <button :class="ghostBtnClass" type="button" :disabled="readOnly" @click="addAccountRow">
        Add mapping
      </button>
    </section>

    <div>
      <button
        type="button"
        class="rounded-xl border border-accent/50 bg-accent-soft px-4 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-55"
        :disabled="readOnly || loading"
        @click="save"
      >
        Save
      </button>
    </div>
  </div>
</template>
