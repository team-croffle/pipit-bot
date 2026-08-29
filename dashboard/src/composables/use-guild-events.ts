import { ref } from 'vue';

import { fetchJson, putJson } from '@/api';
import type { GuildEventSettings } from '@/types';

export function emptyGuildEventSettings(): GuildEventSettings {
  return {
    logChannelId: null,
    joinMessages: [],
    leaveMessages: [],
    joinRoleIds: [],
    reactionRoles: [],
  };
}

/**
 * `PUT /api/guild-events` replaces the whole document — a field left out of the body
 * is stored as empty, not left alone. The invite log and the reaction roles are edited
 * on separate pages, so each page loads the full settings and sends the full settings
 * back, changing only its own slice. Anything else would wipe the other page's data.
 */
export function useGuildEvents() {
  const settings = ref<GuildEventSettings>(emptyGuildEventSettings());
  const loading = ref(true);
  const error = ref('');
  const saved = ref('');

  async function load(): Promise<void> {
    try {
      settings.value = await fetchJson<GuildEventSettings>('/api/guild-events');
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '설정을 불러오지 못했습니다.';
    } finally {
      loading.value = false;
    }
  }

  async function save(patch: Partial<GuildEventSettings>): Promise<void> {
    error.value = '';
    saved.value = '';
    try {
      settings.value = await putJson<GuildEventSettings>('/api/guild-events', {
        ...settings.value,
        ...patch,
      });
      saved.value = '저장했습니다.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '저장하지 못했습니다.';
    }
  }

  return { settings, loading, error, saved, load, save };
}
