<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';

  import { fetchJson, putJson } from '../api';
  import { groupChannels } from '../channels';
  import type {
    BotRuntimeConfig,
    DashboardIdentity,
    DiscordChannel,
    DiscordRole,
    GuildEventSettings,
    ReactionRoleMapping,
  } from '../types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;

  const settings = ref<GuildEventSettings>({
    logChannelId: null,
    joinMessages: [''],
    leaveMessages: [''],
    joinRoleIds: [],
    reactionRoles: [],
  });
  const botConfig = ref<BotRuntimeConfig>({
    prefix: '!',
    musicChannelIds: [],
  });
  const channels = ref<DiscordChannel[]>([]);
  const channelGroups = computed(() => groupChannels(channels.value));
  const roles = ref<DiscordRole[]>([]);
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

  function emptyMapping(): ReactionRoleMapping {
    return { channelId: '', messageId: '', emoji: '', roleId: '' };
  }

  onMounted(async () => {
    try {
      const [loaded, configBody, channelBody, roleBody] = await Promise.all([
        fetchJson<GuildEventSettings>('/api/guild-events'),
        fetchJson<BotRuntimeConfig>('/api/config'),
        fetchJson<{ channels: DiscordChannel[] }>('/api/discord/channels'),
        fetchJson<{ roles: DiscordRole[] }>('/api/discord/roles'),
      ]);
      settings.value = {
        ...loaded,
        joinMessages: loaded.joinMessages.length > 0 ? loaded.joinMessages : [''],
        leaveMessages: loaded.leaveMessages.length > 0 ? loaded.leaveMessages : [''],
      };
      botConfig.value = {
        prefix: configBody.prefix || '!',
        musicChannelIds: configBody.musicChannelIds ?? [],
      };
      channels.value = channelBody.channels;
      roles.value = roleBody.roles;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Failed to load settings';
    } finally {
      loading.value = false;
    }
  });

  function addMessage(list: 'joinMessages' | 'leaveMessages'): void {
    settings.value[list] = [...settings.value[list], ''];
  }

  function removeMessage(list: 'joinMessages' | 'leaveMessages', index: number): void {
    const next = settings.value[list].filter((_, itemIndex) => itemIndex !== index);
    settings.value[list] = next.length > 0 ? next : [''];
  }

  function addReactionRow(): void {
    settings.value.reactionRoles = [...settings.value.reactionRoles, emptyMapping()];
  }

  function removeReactionRow(index: number): void {
    settings.value.reactionRoles = settings.value.reactionRoles.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  function toggleJoinRole(roleId: string): void {
    const current = settings.value.joinRoleIds;
    settings.value.joinRoleIds = current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId];
  }

  function toggleMusicChannel(channelId: string): void {
    const current = botConfig.value.musicChannelIds;
    botConfig.value.musicChannelIds = current.includes(channelId)
      ? current.filter((id) => id !== channelId)
      : [...current, channelId];
  }

  async function save(): Promise<void> {
    error.value = '';
    saved.value = '';
    try {
      const payload: GuildEventSettings = {
        logChannelId: settings.value.logChannelId || null,
        joinMessages: settings.value.joinMessages.map((item) => item.trim()).filter(Boolean),
        leaveMessages: settings.value.leaveMessages.map((item) => item.trim()).filter(Boolean),
        joinRoleIds: settings.value.joinRoleIds,
        reactionRoles: settings.value.reactionRoles.filter(
          (row) => row.channelId && row.messageId && row.emoji.trim() && row.roleId,
        ),
      };
      const [savedEvents, savedConfig] = await Promise.all([
        putJson<GuildEventSettings>('/api/guild-events', payload),
        putJson<BotRuntimeConfig>('/api/config', {
          prefix: botConfig.value.prefix,
          musicChannelIds: botConfig.value.musicChannelIds,
        }),
      ]);
      settings.value = savedEvents;
      botConfig.value = {
        prefix: savedConfig.prefix || '!',
        musicChannelIds: savedConfig.musicChannelIds ?? [],
      };
      if (settings.value.joinMessages.length === 0) {
        settings.value.joinMessages = [''];
      }
      if (settings.value.leaveMessages.length === 0) {
        settings.value.leaveMessages = [''];
      }
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
      <h2 class="mb-3 mt-0 text-base font-semibold">Join / leave</h2>
      <p class="mb-4 text-sm text-muted">
        Placeholders:
        <code class="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-accent">{user}</code>
        <code class="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-accent">{username}</code>
        <code class="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-accent">{inviter}</code>
        <code class="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-accent">{invite}</code>.
        Multiple join/leave lines pick one at random.
      </p>
      <div class="mb-4">
        <label for="log-channel" :class="labelClass">Log channel</label>
        <select
          id="log-channel"
          v-model="settings.logChannelId"
          :class="fieldClass"
          :disabled="readOnly"
        >
          <option :value="null">Not set</option>
          <optgroup v-for="group in channelGroups" :key="group.category" :label="group.category">
            <option
              v-for="channel in group.channels"
              :key="channel.id"
              :value="channel.id"
              :disabled="!channel.canPost"
            >
              {{ channel.name }}{{ channel.canPost ? '' : ' — bot cannot post here' }}
            </option>
          </optgroup>
        </select>
      </div>
      <div class="mb-4">
        <span :class="labelClass">Join messages</span>
        <div
          v-for="(_, index) in settings.joinMessages"
          :key="`join-${index}`"
          class="mb-2 flex flex-col gap-2 sm:flex-row"
        >
          <textarea
            v-model="settings.joinMessages[index]"
            :class="fieldClass"
            :disabled="readOnly"
            placeholder="{user} joined (invited by {inviter})"
            rows="2"
          ></textarea>
          <button
            :class="ghostBtnClass"
            type="button"
            :disabled="readOnly"
            @click="removeMessage('joinMessages', index)"
          >
            Remove
          </button>
        </div>
        <button
          :class="ghostBtnClass"
          type="button"
          :disabled="readOnly"
          @click="addMessage('joinMessages')"
        >
          Add join message
        </button>
      </div>
      <div class="mb-4">
        <span :class="labelClass">Leave messages</span>
        <div
          v-for="(_, index) in settings.leaveMessages"
          :key="`leave-${index}`"
          class="mb-2 flex flex-col gap-2 sm:flex-row"
        >
          <textarea
            v-model="settings.leaveMessages[index]"
            :class="fieldClass"
            :disabled="readOnly"
            placeholder="{username} left"
            rows="2"
          ></textarea>
          <button
            :class="ghostBtnClass"
            type="button"
            :disabled="readOnly"
            @click="removeMessage('leaveMessages', index)"
          >
            Remove
          </button>
        </div>
        <button
          :class="ghostBtnClass"
          type="button"
          :disabled="readOnly"
          @click="addMessage('leaveMessages')"
        >
          Add leave message
        </button>
      </div>
      <div>
        <span :class="labelClass">Roles on join</span>
        <div class="flex flex-wrap gap-3">
          <label v-for="role in roles" :key="role.id" class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="accent-accent"
              :checked="settings.joinRoleIds.includes(role.id)"
              :disabled="readOnly"
              @change="toggleJoinRole(role.id)"
            />
            {{ role.name }}
          </label>
        </div>
      </div>
    </section>

    <section v-if="!loading" :class="cardClass">
      <h2 class="mb-3 mt-0 text-base font-semibold">Reaction roles</h2>
      <p class="mb-4 text-sm text-muted">
        Reacting adds the role; removing the reaction takes it away.
      </p>
      <div
        v-for="(row, index) in settings.reactionRoles"
        :key="`rr-${index}`"
        class="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_1fr_auto]"
      >
        <select v-model="row.channelId" :class="fieldClass" :disabled="readOnly">
          <option value="">Channel</option>
          <optgroup v-for="group in channelGroups" :key="group.category" :label="group.category">
            <option
              v-for="channel in group.channels"
              :key="channel.id"
              :value="channel.id"
              :disabled="!channel.canPost"
            >
              {{ channel.name }}{{ channel.canPost ? '' : ' — bot cannot post here' }}
            </option>
          </optgroup>
        </select>
        <input
          v-model="row.messageId"
          :class="fieldClass"
          :disabled="readOnly"
          placeholder="Message ID"
        />
        <input v-model="row.emoji" :class="fieldClass" :disabled="readOnly" placeholder="Emoji" />
        <select v-model="row.roleId" :class="fieldClass" :disabled="readOnly">
          <option value="">Role</option>
          <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
        </select>
        <button
          :class="ghostBtnClass"
          type="button"
          :disabled="readOnly"
          @click="removeReactionRow(index)"
        >
          Remove
        </button>
      </div>
      <button :class="ghostBtnClass" type="button" :disabled="readOnly" @click="addReactionRow">
        Add reaction role
      </button>
    </section>

    <section v-if="!loading" :class="cardClass">
      <h2 class="mb-3 mt-0 text-base font-semibold">Music</h2>
      <p class="mb-4 text-sm text-muted">
        Restrict music commands to selected text channels. Leave all unchecked to allow any channel.
      </p>
      <div>
        <span :class="labelClass">Music channels</span>
        <div class="flex flex-col gap-3">
          <div v-for="group in channelGroups" :key="group.category">
            <span class="mb-1.5 block text-xs uppercase tracking-wide text-muted">
              {{ group.category }}
            </span>
            <div class="flex flex-wrap gap-3">
              <label
                v-for="channel in group.channels"
                :key="channel.id"
                class="flex items-center gap-2 text-sm"
                :class="channel.canPost ? '' : 'text-muted'"
                :title="channel.canPost ? '' : 'The bot cannot post in this channel.'"
              >
                <input
                  type="checkbox"
                  class="accent-accent"
                  :checked="botConfig.musicChannelIds.includes(channel.id)"
                  :disabled="readOnly || !channel.canPost"
                  @change="toggleMusicChannel(channel.id)"
                />
                {{ channel.name }}
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="!loading" :class="cardClass">
      <h2 class="mb-3 mt-0 text-base font-semibold">Bot settings</h2>
      <p class="mb-4 text-sm text-muted">Prefix applies immediately. RSS is not wired yet.</p>
      <div class="mb-4">
        <label for="prefix" :class="labelClass">Command prefix</label>
        <input
          id="prefix"
          v-model="botConfig.prefix"
          :class="fieldClass"
          :disabled="readOnly"
          placeholder="!"
        />
      </div>
      <div>
        <label for="rss" :class="labelClass">Blog RSS feed</label>
        <input id="rss" :class="fieldClass" disabled placeholder="Coming soon" />
      </div>
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
