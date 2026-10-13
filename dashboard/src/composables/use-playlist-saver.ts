import { ref } from 'vue';

import { fetchJson, postJson } from '@/api';
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
          ? `"${playlist.name}"에 ${result.added}곡을 담았습니다. ${result.skipped}곡은 가득 차 빠졌습니다.`
          : `"${playlist.name}"에 ${result.added > 1 ? `${result.added}곡을 ` : ''}담았습니다.`,
      );
      return true;
    } catch (cause) {
      say(false, cause instanceof Error ? cause.message : '재생목록에 담지 못했습니다.');
      return false;
    }
  }

  async function createAndSave(name: string, source: PlaylistItemSource): Promise<boolean> {
    try {
      const made = await postJson<PlaylistDetail>('/api/playlists', { name, scope: 'shared' });
      return await save(made, source);
    } catch (cause) {
      say(false, cause instanceof Error ? cause.message : '재생목록을 만들지 못했습니다.');
      return false;
    }
  }

  return { playlists, loading, loadPlaylists, save, createAndSave };
}
