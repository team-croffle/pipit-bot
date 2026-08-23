<script setup lang="ts">
  import { onMounted, ref } from 'vue';

  import { fetchJson, putJson } from '../api';
  import type {
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
  const channels = ref<DiscordChannel[]>([]);
  const roles = ref<DiscordRole[]>([]);
  const error = ref('');
  const saved = ref('');
  const loading = ref(true);

  function emptyMapping(): ReactionRoleMapping {
    return { channelId: '', messageId: '', emoji: '', roleId: '' };
  }

  onMounted(async () => {
    try {
      const [loaded, channelBody, roleBody] = await Promise.all([
        fetchJson<GuildEventSettings>('/api/guild-events'),
        fetchJson<{ channels: DiscordChannel[] }>('/api/discord/channels'),
        fetchJson<{ roles: DiscordRole[] }>('/api/discord/roles'),
      ]);
      settings.value = {
        ...loaded,
        joinMessages: loaded.joinMessages.length > 0 ? loaded.joinMessages : [''],
        leaveMessages: loaded.leaveMessages.length > 0 ? loaded.leaveMessages : [''],
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
      settings.value = await putJson<GuildEventSettings>('/api/guild-events', payload);
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
  <div class="grid">
    <p v-if="readOnly" class="banner">View only — you can open settings but cannot save changes.</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="saved" class="empty">{{ saved }}</p>
    <p v-if="loading" class="empty">Loading…</p>

    <section v-if="!loading" class="card">
      <h2>Join / leave</h2>
      <p class="empty">
        Placeholders: <code>{user}</code> <code>{username}</code> <code>{inviter}</code>
        <code>{invite}</code>. Multiple join/leave lines pick one at random.
      </p>
      <div class="field">
        <label for="log-channel">Log channel</label>
        <select id="log-channel" v-model="settings.logChannelId" :disabled="readOnly">
          <option :value="null">Not set</option>
          <option v-for="channel in channels" :key="channel.id" :value="channel.id">
            {{ channel.name }}
          </option>
        </select>
      </div>
      <div class="field">
        <span class="label">Join messages</span>
        <div v-for="(_, index) in settings.joinMessages" :key="`join-${index}`" class="stack-row">
          <textarea
            v-model="settings.joinMessages[index]"
            :disabled="readOnly"
            placeholder="{user} joined (invited by {inviter})"
          ></textarea>
          <button
            class="ghost"
            type="button"
            :disabled="readOnly"
            @click="removeMessage('joinMessages', index)"
          >
            Remove
          </button>
        </div>
        <button
          class="ghost"
          type="button"
          :disabled="readOnly"
          @click="addMessage('joinMessages')"
        >
          Add join message
        </button>
      </div>
      <div class="field">
        <span class="label">Leave messages</span>
        <div v-for="(_, index) in settings.leaveMessages" :key="`leave-${index}`" class="stack-row">
          <textarea
            v-model="settings.leaveMessages[index]"
            :disabled="readOnly"
            placeholder="{username} left"
          ></textarea>
          <button
            class="ghost"
            type="button"
            :disabled="readOnly"
            @click="removeMessage('leaveMessages', index)"
          >
            Remove
          </button>
        </div>
        <button
          class="ghost"
          type="button"
          :disabled="readOnly"
          @click="addMessage('leaveMessages')"
        >
          Add leave message
        </button>
      </div>
      <div class="field">
        <span class="label">Roles on join</span>
        <div class="role-list">
          <label v-for="role in roles" :key="role.id" class="check">
            <input
              type="checkbox"
              :checked="settings.joinRoleIds.includes(role.id)"
              :disabled="readOnly"
              @change="toggleJoinRole(role.id)"
            />
            {{ role.name }}
          </label>
        </div>
      </div>
    </section>

    <section v-if="!loading" class="card">
      <h2>Reaction roles</h2>
      <p class="empty">Reacting adds the role; removing the reaction takes it away.</p>
      <div v-for="(row, index) in settings.reactionRoles" :key="`rr-${index}`" class="reaction-row">
        <select v-model="row.channelId" :disabled="readOnly">
          <option value="">Channel</option>
          <option v-for="channel in channels" :key="channel.id" :value="channel.id">
            {{ channel.name }}
          </option>
        </select>
        <input v-model="row.messageId" :disabled="readOnly" placeholder="Message ID" />
        <input v-model="row.emoji" :disabled="readOnly" placeholder="Emoji" />
        <select v-model="row.roleId" :disabled="readOnly">
          <option value="">Role</option>
          <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
        </select>
        <button class="ghost" type="button" :disabled="readOnly" @click="removeReactionRow(index)">
          Remove
        </button>
      </div>
      <button class="ghost" type="button" :disabled="readOnly" @click="addReactionRow">
        Add reaction role
      </button>
    </section>

    <section class="card">
      <h2>Bot settings</h2>
      <p class="empty">
        Prefix, command channel, and RSS registration will be wired after the Discord config
        commands land.
      </p>
      <div class="field">
        <label for="prefix">Command prefix</label>
        <input id="prefix" value="!" disabled placeholder="Coming soon" />
      </div>
      <div class="field">
        <label for="channel">Command channel</label>
        <input id="channel" disabled placeholder="Coming soon" />
      </div>
      <div class="field">
        <label for="rss">Blog RSS feed</label>
        <input id="rss" disabled placeholder="Coming soon" />
      </div>
    </section>

    <div>
      <button class="primary" type="button" :disabled="readOnly || loading" @click="save">
        Save
      </button>
    </div>
  </div>
</template>
