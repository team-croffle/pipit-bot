import { computed, onUnmounted, ref } from 'vue';

import { fetchJson, postJson } from '@/api';
import type { PlaybackActionResult, PlaybackRepeatMode, PlaybackState } from '@/types';

function isRedirect(cause: unknown): boolean {
  return cause instanceof Error && cause.message.startsWith('Redirecting to login');
}

/** How often the page asks the bot; between asks it runs the clock itself. */
const SYNC_MS = 30_000;
/** While a track is being prepared the page asks more often, so it shows up when ready. */
const PREPARING_SYNC_MS = 3_000;
const CLOCK_MS = 1_000;
/** The bot may take a moment to start the next track; ask again no sooner than this. */
const END_SYNC_GAP_MS = 3_000;

function timeLabel(ms: number): string {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/**
 * One sync loop shared by every music panel — the page shows the same playback state in
 * several places, and each panel opening its own interval would multiply the requests.
 *
 * WHY the page keeps its own clock: asking the bot every few seconds only to move a
 * progress bar is wasted work. The page asks when it opens, every thirty seconds, after
 * its own actions, when it comes back into view and when its clock says the track has
 * ended; in between it advances the position itself. Changes made elsewhere (Discord)
 * show up at the next sync.
 */
export function usePlayback() {
  const synced = ref<PlaybackState | null>(null);
  /** When `synced` arrived, on the page's clock. */
  let syncedAt = 0;
  const now = ref(Date.now());
  const loading = ref(true);
  const error = ref('');
  const message = ref('');
  const busy = ref(false);
  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  let clockTimer: ReturnType<typeof setInterval> | undefined;
  /** When the clock last asked because a track ended — at most every few seconds. */
  let endSyncAt = 0;

  /** The last state from the bot, with the position moved on by the page's clock. */
  const playback = computed<PlaybackState | null>(() => {
    const state = synced.value;
    const current = state?.current;
    if (!state || !current || !state.active || state.paused || !(current.durationMs > 0)) {
      return state;
    }
    const positionMs = Math.min(current.positionMs + (now.value - syncedAt), current.durationMs);
    return {
      ...state,
      current: {
        ...current,
        positionMs,
        progress: positionMs / current.durationMs,
        positionLabel: timeLabel(positionMs),
      },
    };
  });

  function scheduleSync(): void {
    clearTimeout(syncTimer);
    const preparing = synced.value?.status === 'loading';
    syncTimer = setTimeout(() => void refresh(), preparing ? PREPARING_SYNC_MS : SYNC_MS);
  }

  async function refresh(): Promise<void> {
    try {
      const state = await fetchJson<PlaybackState>('/api/music/playback');
      synced.value = state;
      syncedAt = Date.now();
      now.value = syncedAt;
      error.value = '';
    } catch (cause) {
      if (isRedirect(cause)) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '재생 상태를 불러오지 못했습니다.';
    } finally {
      loading.value = false;
      scheduleSync();
    }
  }

  /** The clock: moves the position, and asks the bot once when a track should have ended. */
  function tick(): void {
    now.value = Date.now();
    const current = playback.value?.current;
    if (
      current &&
      playback.value?.active &&
      !playback.value.paused &&
      current.durationMs > 0 &&
      current.positionMs >= current.durationMs &&
      now.value - endSyncAt > END_SYNC_GAP_MS
    ) {
      endSyncAt = now.value;
      void refresh();
    }
  }

  function onVisible(): void {
    if (document.visibilityState === 'visible') {
      void refresh();
    }
  }

  /**
   * WHY the previous message is left standing until the new one arrives: clearing it
   * up front emptied the status line for the length of the request, which collapsed
   * the card and sprang it back. `busy` is what tells the panel a request is running;
   * the text does not have to disappear to say the same thing.
   */
  async function run(path: string, body?: unknown, fallback = '요청을 처리하지 못했습니다.') {
    busy.value = true;
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

  /** `next` puts the track at the front of the queue, like `!playnext`. */
  async function enqueue(query: string, next = false): Promise<boolean> {
    const trimmed = query.trim();
    if (!trimmed || !playback.value?.canEnqueue) {
      return false;
    }

    busy.value = true;
    try {
      await postJson('/api/music/jobs', {
        jobId: crypto.randomUUID(),
        query: trimmed,
        ...(next ? { next: true } : {}),
      });
      message.value = next
        ? '다음 순서로 재생할 트랙을 준비하고 있습니다…'
        : '트랙을 준비하고 있습니다…';
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
    clockTimer = setInterval(tick, CLOCK_MS);
    document.addEventListener('visibilitychange', onVisible);
  }

  onUnmounted(() => {
    clearTimeout(syncTimer);
    clearInterval(clockTimer);
    document.removeEventListener('visibilitychange', onVisible);
  });

  return { playback, loading, error, message, busy, refresh, run, setRepeat, enqueue, start };
}
