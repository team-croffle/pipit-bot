import { ref } from 'vue';

import { deleteJson, fetchJson, patchJson, postJson } from '@/api';
import { t } from '@/i18n';
import type {
  PlaybackActionResult,
  PlaylistDetail,
  PlaylistItemSource,
  PlaylistScope,
  PlaylistSummary,
} from '@/types';

const path = (id: string) => `/api/playlists/${encodeURIComponent(id)}`;

function isRedirect(cause: unknown): boolean {
  return cause instanceof Error && cause.message.startsWith('Redirecting to login');
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

/**
 * The playlists the signed-in user can see, the one open, and every change to them.
 * Every action reloads what it touched, so the list and the open playlist stay in step.
 */
export function usePlaylists() {
  const playlists = ref<PlaylistSummary[]>([]);
  const selected = ref<PlaylistDetail | null>(null);
  const loading = ref(true);
  const busy = ref(false);
  const error = ref('');
  const message = ref('');

  async function load(): Promise<void> {
    try {
      const body = await fetchJson<{ playlists: PlaylistSummary[]; loadError: string | null }>(
        '/api/playlists',
      );
      playlists.value = body.playlists;
      error.value = body.loadError ?? '';
    } catch (cause) {
      if (!isRedirect(cause)) {
        error.value = messageOf(cause, t('playlists.loadFailed'));
      }
    } finally {
      loading.value = false;
    }
  }

  async function open(id: string): Promise<void> {
    try {
      selected.value = await fetchJson<PlaylistDetail>(`/api/playlists/${encodeURIComponent(id)}`);
    } catch (cause) {
      if (!isRedirect(cause)) {
        error.value = messageOf(cause, t('playlists.openFailed'));
      }
    }
  }

  /** Runs one change; on success shows `done` and refreshes the list and the open playlist. */
  async function act<T>(work: () => Promise<T>, done: string, fallback: string): Promise<T | null> {
    busy.value = true;
    error.value = '';
    try {
      const result = await work();
      message.value = done;
      await load();
      return result;
    } catch (cause) {
      if (!isRedirect(cause)) {
        error.value = messageOf(cause, fallback);
      }
      return null;
    } finally {
      busy.value = false;
    }
  }

  async function create(
    name: string,
    scope: PlaylistScope = 'shared',
  ): Promise<PlaylistDetail | null> {
    const made = await act(
      () => postJson<PlaylistDetail>('/api/playlists', { name, scope }),
      t('playlists.created', { name }),
      t('playlists.createFailed'),
    );
    if (made) {
      selected.value = made;
    }
    return made;
  }

  async function rename(id: string, name: string): Promise<void> {
    const renamed = await act(
      () => patchJson<PlaylistDetail>(path(id), { name }),
      t('playlists.renamed'),
      t('playlists.renameFailed'),
    );
    if (renamed) {
      selected.value = renamed;
    }
  }

  async function remove(id: string): Promise<void> {
    const removed = await act(
      () => deleteJson(path(id)),
      t('playlists.deleted'),
      t('playlists.deleteFailed'),
    );
    if (removed && selected.value?.id === id) {
      selected.value = null;
    }
  }

  async function addItem(id: string, source: PlaylistItemSource): Promise<boolean> {
    const result = await act(
      () =>
        postJson<PlaylistDetail & { added: number; skipped: number }>(`${path(id)}/items`, source),
      t('playlists.added'),
      t('playlists.saveFailed'),
    );
    if (result) {
      if (result.skipped > 0) {
        message.value = t('playlists.addedSkipped', {
          added: result.added,
          skipped: result.skipped,
        });
      }
      if (selected.value?.id === id) {
        selected.value = result;
      }
    }
    return result !== null;
  }

  async function removeItem(id: string, itemId: string): Promise<void> {
    const result = await act(
      () => deleteJson<PlaylistDetail>(`${path(id)}/items/${encodeURIComponent(itemId)}`),
      t('playlists.itemRemoved'),
      t('playlists.itemRemoveFailed'),
    );
    if (result) {
      selected.value = result;
    }
  }

  async function moveItem(id: string, itemId: string, to: number): Promise<void> {
    const result = await act(
      () =>
        postJson<PlaylistDetail>(`${path(id)}/items/${encodeURIComponent(itemId)}/move`, { to }),
      t('playlists.moved'),
      t('playlists.moveFailed'),
    );
    if (result) {
      selected.value = result;
    }
  }

  /** Imports what the music worker expands a link into — into this playlist, or a new one. */
  async function importLink(
    query: string,
    target: { into: string } | { name?: string; scope: PlaylistScope },
  ): Promise<boolean> {
    const result = await act(
      () =>
        'into' in target
          ? postJson<PlaylistDetail & { added: number; skipped: number }>(
              `${path(target.into)}/import`,
              { query },
            )
          : postJson<PlaylistDetail & { added: number; skipped: number }>('/api/playlists/import', {
              query,
              ...target,
            }),
      t('playlists.imported'),
      t('playlists.importFailed'),
    );
    if (result) {
      message.value =
        result.skipped > 0
          ? t('playlists.importedSkipped', {
              name: result.name,
              added: result.added,
              skipped: result.skipped,
            })
          : t('playlists.importedInto', { name: result.name, count: result.added }, result.added);
      selected.value = result;
    }
    return result !== null;
  }

  async function play(id: string, shuffle: boolean): Promise<void> {
    await act(
      () => postJson<PlaybackActionResult>(`${path(id)}/play`, { shuffle }),
      shuffle ? t('playlists.playingShuffled') : t('playlists.playing'),
      t('playlists.playFailed'),
    );
  }

  return {
    playlists,
    selected,
    loading,
    busy,
    error,
    message,
    load,
    open,
    create,
    rename,
    remove,
    addItem,
    removeItem,
    moveItem,
    play,
    importLink,
  };
}
