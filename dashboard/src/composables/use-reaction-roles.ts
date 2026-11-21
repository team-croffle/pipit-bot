import { ref } from 'vue';

import { fetchJson, postJson, putJson } from '@/api';
import { t } from '@/i18n';
import type { PublishPanelResult, ReactionRolePanel, ReactionRoleSettings } from '@/types';

export function emptyEmbed() {
  return {
    content: '',
    title: '',
    description: '',
    fields: [],
    footer: '',
    color: '',
    showTimestamp: false,
  };
}

export function emptyPanel(): ReactionRolePanel {
  return {
    // The id only has to be unique within this file, and it has to survive a rename.
    id: `panel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    channelId: '',
    messageId: null,
    singleReaction: false,
    embed: emptyEmbed(),
    options: [],
  };
}

/**
 * The panels, and the publish action.
 *
 * WHY publishing saves first: the route publishes what is stored, not what is on
 * screen, so an operator who edits and then publishes would otherwise send the
 * version before their edit.
 */
export function useReactionRoles() {
  const panels = ref<ReactionRolePanel[]>([]);
  const guildId = ref<string | null>(null);
  const loading = ref(true);
  const error = ref('');
  const saved = ref('');
  const busy = ref(false);
  /** The server could not read its file and is running on defaults. */
  const loadError = ref('');

  function report(cause: unknown, fallback: string): void {
    if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
      return;
    }

    error.value = cause instanceof Error ? cause.message : fallback;
  }

  async function load(): Promise<void> {
    try {
      const body = await fetchJson<ReactionRoleSettings>('/api/reaction-roles');
      panels.value = body.panels;
      guildId.value = body.guildId ?? null;
      loadError.value = body.loadError ?? '';
    } catch (cause) {
      report(cause, t('reactionRoles.loadFailed'));
    } finally {
      loading.value = false;
    }
  }

  async function save(): Promise<boolean> {
    error.value = '';
    saved.value = '';
    busy.value = true;
    try {
      const body = await putJson<ReactionRoleSettings>('/api/reaction-roles', {
        panels: panels.value,
      });
      panels.value = body.panels;
      saved.value = t('reactionRoles.saved');
      loadError.value = '';
      return true;
    } catch (cause) {
      report(cause, t('reactionRoles.saveFailed'));
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function publish(panelId: string): Promise<void> {
    if (!(await save())) {
      return;
    }

    busy.value = true;
    try {
      const result = await postJson<PublishPanelResult>(
        `/api/reaction-roles/${panelId}/publish`,
        {},
      );
      panels.value = panels.value.map((panel) =>
        panel.id === result.panel.id ? result.panel : panel,
      );
      const notes = [...result.warnings];
      if (result.failedEmoji.length > 0) {
        notes.unshift(t('reactionRoles.emojiFailed', { emoji: result.failedEmoji.join(' ') }));
      }

      saved.value =
        notes.length > 0
          ? t('reactionRoles.publishedBut', { notes: notes.join(' ') })
          : t('reactionRoles.publishDone');
    } catch (cause) {
      saved.value = '';
      report(cause, t('reactionRoles.publishFailed'));
    } finally {
      busy.value = false;
    }
  }

  return { panels, guildId, loading, error, saved, busy, loadError, load, save, publish };
}
