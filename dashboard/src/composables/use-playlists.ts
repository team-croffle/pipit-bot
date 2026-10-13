import { ref } from 'vue';

import { deleteJson, fetchJson, patchJson, postJson } from '@/api';
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
        error.value = messageOf(cause, '재생목록을 불러오지 못했습니다.');
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
        error.value = messageOf(cause, '재생목록을 열지 못했습니다.');
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
      `"${name}" 재생목록을 만들었습니다.`,
      '재생목록을 만들지 못했습니다.',
    );
    if (made) {
      selected.value = made;
    }
    return made;
  }

  async function rename(id: string, name: string): Promise<void> {
    const renamed = await act(
      () => patchJson<PlaylistDetail>(path(id), { name }),
      '이름을 바꿨습니다.',
      '이름을 바꾸지 못했습니다.',
    );
    if (renamed) {
      selected.value = renamed;
    }
  }

  async function remove(id: string): Promise<void> {
    const removed = await act(
      () => deleteJson(path(id)),
      '재생목록을 지웠습니다.',
      '지우지 못했습니다.',
    );
    if (removed && selected.value?.id === id) {
      selected.value = null;
    }
  }

  async function addItem(id: string, source: PlaylistItemSource): Promise<boolean> {
    const result = await act(
      () =>
        postJson<PlaylistDetail & { added: number; skipped: number }>(`${path(id)}/items`, source),
      '재생목록에 담았습니다.',
      '재생목록에 담지 못했습니다.',
    );
    if (result) {
      if (result.skipped > 0) {
        message.value = `${result.added}곡을 담았습니다. ${result.skipped}곡은 재생목록이 가득 차 빠졌습니다.`;
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
      '곡을 뺐습니다.',
      '곡을 빼지 못했습니다.',
    );
    if (result) {
      selected.value = result;
    }
  }

  async function moveItem(id: string, itemId: string, to: number): Promise<void> {
    const result = await act(
      () =>
        postJson<PlaylistDetail>(`${path(id)}/items/${encodeURIComponent(itemId)}/move`, { to }),
      '순서를 바꿨습니다.',
      '순서를 바꾸지 못했습니다.',
    );
    if (result) {
      selected.value = result;
    }
  }

  async function play(id: string, shuffle: boolean): Promise<void> {
    await act(
      () => postJson<PlaybackActionResult>(`${path(id)}/play`, { shuffle }),
      shuffle
        ? '섞어서 재생합니다. 몇 곡씩 앞서 준비하며 이어 갑니다.'
        : '재생합니다. 몇 곡씩 앞서 준비하며 이어 갑니다.',
      '재생하지 못했습니다.',
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
  };
}
