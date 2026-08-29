import { onUnmounted, ref } from 'vue';

import { fetchJson, postJson } from '@/api';
import type { PlaybackActionResult, PlaybackRepeatMode, PlaybackState } from '@/types';

function isRedirect(cause: unknown): boolean {
  return cause instanceof Error && cause.message.startsWith('Redirecting to login');
}

/**
 * One polling loop shared by every music panel — the page shows the same playback
 * state in several places, and each panel opening its own interval would multiply
 * the requests for no gain.
 */
export function usePlayback() {
  const playback = ref<PlaybackState | null>(null);
  const loading = ref(true);
  const error = ref('');
  const message = ref('');
  const busy = ref(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  async function refresh(): Promise<void> {
    try {
      playback.value = await fetchJson<PlaybackState>('/api/music/playback');
      error.value = '';
    } catch (cause) {
      if (isRedirect(cause)) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '재생 상태를 불러오지 못했습니다.';
    } finally {
      loading.value = false;
    }
  }

  async function run(path: string, body?: unknown, fallback = '요청을 처리하지 못했습니다.') {
    busy.value = true;
    message.value = '';
    try {
      const result = await postJson<PlaybackActionResult>(path, body);
      message.value = result.message;
      error.value = result.ok ? '' : result.message;
      await refresh();
    } catch (cause) {
      if (isRedirect(cause)) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : fallback;
    } finally {
      busy.value = false;
    }
  }

  async function setRepeat(mode: PlaybackRepeatMode): Promise<void> {
    if (playback.value?.repeatMode === mode) {
      return;
    }

    await run('/api/music/playback/loop', { mode }, '반복 모드를 바꾸지 못했습니다.');
  }

  async function enqueue(query: string): Promise<boolean> {
    const trimmed = query.trim();
    if (!trimmed || !playback.value?.canEnqueue) {
      return false;
    }

    busy.value = true;
    message.value = '';
    try {
      await postJson('/api/music/jobs', { jobId: crypto.randomUUID(), query: trimmed });
      message.value = '트랙을 준비하고 있습니다…';
      error.value = '';
      await refresh();
      return true;
    } catch (cause) {
      if (isRedirect(cause)) {
        return false;
      }
      error.value = cause instanceof Error ? cause.message : '대기열에 추가하지 못했습니다.';
      return false;
    } finally {
      busy.value = false;
    }
  }

  function start(): void {
    void refresh();
    timer = setInterval(() => {
      void refresh();
    }, 3000);
  }

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer);
    }
  });

  return { playback, loading, error, message, busy, refresh, run, setRepeat, enqueue, start };
}
