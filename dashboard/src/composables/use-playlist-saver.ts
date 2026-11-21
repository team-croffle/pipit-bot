import { ref } from 'vue';

import { fetchJson, postJson } from '@/api';
import { t } from '@/i18n';
import type { PlaylistDetail, PlaylistItemSource, PlaylistSummary } from '@/types';

/** What the last save said, for the music page's status line. */
export const playlistFeedback = ref<{ ok: boolean; message: string; at: number } | null>(null);

function say(ok: boolean, message: string): void {
  playlistFeedback.value = { ok, message, at: Date.now() };
}

/**
 * Saving a track (or the queue) to a playlist from wherever it is shown. The list of
 * playlists is fetched when a menu opens, so it is never stale for long.
 */
export function usePlaylistSaver() {
  const playlists = ref<PlaylistSummary[]>([]);
  const loading = ref(false);

  async function loadPlaylists(): Promise<void> {
    loading.value = true;
    try {
      const body = await fetchJson<{ playlists: PlaylistSummary[] }>('/api/playlists');
      playlists.value = body.playlists;
    } catch {
      playlists.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function save(
    playlist: { id: string; name: string },
    source: PlaylistItemSource,
  ): Promise<boolean> {
    try {
      const result = await postJson<PlaylistDetail & { added: number; skipped: number }>(
        `/api/playlists/${encodeURIComponent(playlist.id)}/items`,
        source,
      );
      say(
        true,
        result.skipped > 0
          ? t('playlists.savedSkipped', {
              name: playlist.name,
              added: result.added,
              skipped: result.skipped,
            })
          : result.added > 1
            ? t('playlists.savedMany', { name: playlist.name, count: result.added }, result.added)
            : t('playlists.savedOne', { name: playlist.name }),
      );
      return true;
    } catch (cause) {
      say(false, cause instanceof Error ? cause.message : t('playlists.saveFailed'));
      return false;
    }
  }

  async function createAndSave(name: string, source: PlaylistItemSource): Promise<boolean> {
    try {
      const made = await postJson<PlaylistDetail>('/api/playlists', { name, scope: 'shared' });
      return await save(made, source);
    } catch (cause) {
      say(false, cause instanceof Error ? cause.message : t('playlists.createFailed'));
      return false;
    }
  }

  return { playlists, loading, loadPlaylists, save, createAndSave };
}
