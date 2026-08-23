<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue';

  import { fetchJson, postJson } from '../api';
  import type {
    PlaybackActionResult,
    PlaybackRepeatMode,
    PlaybackState,
    PlaybackStatus,
  } from '../types';

  const playback = ref<PlaybackState | null>(null);
  const query = ref('');
  const error = ref('');
  const actionMessage = ref('');
  const busy = ref(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  const statusClasses: Record<PlaybackStatus, string> = {
    loading: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
    playing: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
    paused: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-400',
    ready: 'border-blue-500/30 bg-blue-500/15 text-blue-400',
    idle: 'border-zinc-500/30 bg-zinc-500/15 text-zinc-400',
  };

  const loopModes: { value: PlaybackRepeatMode; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: 'track', label: 'Track' },
    { value: 'queue', label: 'Queue' },
  ];

  const transportBtnClass =
    'rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-muted transition hover:border-line hover:bg-panel-hover hover:text-text disabled:opacity-55';

  function formatStatus(status: PlaybackStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  async function refresh(): Promise<void> {
    try {
      playback.value = await fetchJson<PlaybackState>('/api/music/playback');
      error.value = '';
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : 'Failed to load playback';
    }
  }

  async function runAction(path: string): Promise<void> {
    busy.value = true;
    actionMessage.value = '';
    try {
      const result = await postJson<PlaybackActionResult>(path);
      actionMessage.value = result.message;
      if (!result.ok) {
        error.value = result.message;
      } else {
        error.value = '';
      }
      await refresh();
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : 'Action failed';
    } finally {
      busy.value = false;
    }
  }

  async function setLoop(mode: PlaybackRepeatMode): Promise<void> {
    if (playback.value?.repeatMode === mode) {
      return;
    }

    busy.value = true;
    actionMessage.value = '';
    try {
      const result = await postJson<PlaybackActionResult>('/api/music/playback/loop', { mode });
      actionMessage.value = result.message;
      if (!result.ok) {
        error.value = result.message;
      } else {
        error.value = '';
      }
      await refresh();
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : 'Failed to set loop mode';
    } finally {
      busy.value = false;
    }
  }

  async function enqueue(): Promise<void> {
    const trimmed = query.value.trim();
    if (!trimmed || !playback.value?.canEnqueue) {
      return;
    }

    busy.value = true;
    actionMessage.value = '';
    try {
      await postJson('/api/music/jobs', {
        jobId: crypto.randomUUID(),
        query: trimmed,
      });
      query.value = '';
      actionMessage.value = 'Preparing track…';
      error.value = '';
      await refresh();
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : 'Failed to enqueue';
    } finally {
      busy.value = false;
    }
  }

  onMounted(async () => {
    await refresh();
    timer = setInterval(() => {
      void refresh();
    }, 3000);
  });

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer);
    }
  });
</script>

<template>
  <section
    class="rounded-2xl border border-line-soft bg-panel p-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)] sm:p-5"
  >
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="m-0 text-base font-semibold">Playback</h2>
      <span
        v-if="playback"
        class="rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide"
        :class="statusClasses[playback.status]"
      >
        {{ formatStatus(playback.status) }}
      </span>
    </div>

    <form class="mb-3 flex flex-col gap-2 sm:flex-row" @submit.prevent="enqueue">
      <input
        v-model="query"
        type="text"
        placeholder="Search or paste a query…"
        class="min-w-0 flex-1 rounded-xl border border-line bg-bg-elevated px-3 py-2.5 text-sm text-text outline-none transition focus:border-accent"
        :disabled="!playback?.canEnqueue || busy"
      />
      <button
        type="submit"
        class="rounded-xl border border-accent/50 bg-accent-soft px-4 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-55"
        :disabled="!playback?.canEnqueue || busy || !query.trim()"
      >
        Play
      </button>
    </form>

    <p v-if="playback && !playback.canEnqueue" class="mb-3 text-sm text-muted">
      Join the bot to a voice channel before adding tracks.
    </p>

    <p v-if="error" class="mb-3 text-sm text-bad">{{ error }}</p>
    <p v-else-if="actionMessage" class="mb-3 text-sm text-muted">{{ actionMessage }}</p>

    <div v-if="playback?.active && playback.current" class="mb-4">
      <p class="mb-2 text-base font-medium">{{ playback.current.title }}</p>
      <div class="h-1.5 overflow-hidden rounded-full bg-line-soft" aria-hidden="true">
        <div
          class="h-full rounded-full bg-accent transition-[width] duration-300"
          :style="{ width: `${Math.round(playback.current.progress * 100)}%` }"
        ></div>
      </div>
      <p class="mt-1.5 flex justify-between text-xs text-muted">
        <span>{{ playback.current.positionLabel }}</span>
        <span>{{ playback.current.durationLabel }}</span>
      </p>
      <p v-if="playback.voiceChannelName" class="mt-2 text-sm text-muted">
        Voice: {{ playback.voiceChannelName }}
        <span v-if="playback.repeatMode !== 'off'"> · repeat {{ playback.repeatMode }}</span>
      </p>
    </div>
    <p v-else class="mb-4 text-sm text-muted">
      Nothing playing. Enqueue a track above or use Discord commands.
    </p>

    <div class="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        :class="transportBtnClass"
        :disabled="busy || !playback?.active || playback.paused"
        @click="runAction('/api/music/playback/pause')"
      >
        Pause
      </button>
      <button
        type="button"
        :class="transportBtnClass"
        :disabled="busy || !playback?.active || !playback.paused"
        @click="runAction('/api/music/playback/resume')"
      >
        Resume
      </button>
      <button
        type="button"
        :class="transportBtnClass"
        :disabled="busy || !playback?.active"
        @click="runAction('/api/music/playback/skip')"
      >
        Skip
      </button>
      <button
        type="button"
        :class="transportBtnClass"
        :disabled="busy || !playback?.active"
        @click="runAction('/api/music/playback/stop')"
      >
        Stop
      </button>
      <button
        type="button"
        :class="transportBtnClass"
        :disabled="busy || !playback?.active || playback.pendingCount === 0"
        @click="runAction('/api/music/playback/clear')"
      >
        Clear queue
      </button>
    </div>

    <div v-if="playback?.active" class="mb-4 flex flex-wrap items-center gap-2">
      <span class="text-sm text-muted">Loop</span>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="mode in loopModes"
          :key="mode.value"
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-55"
          :class="
            playback.repeatMode === mode.value
              ? 'border-accent/50 bg-accent-soft text-accent'
              : 'border-line bg-transparent text-muted hover:border-line hover:bg-panel-hover hover:text-text'
          "
          :disabled="busy"
          @click="setLoop(mode.value)"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <div v-if="playback?.active" class="border-t border-line-soft pt-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 class="m-0 text-sm font-semibold">Up next</h3>
        <span class="text-xs text-muted">
          {{ playback.pendingCount }} track{{ playback.pendingCount === 1 ? '' : 's' }}
          <template v-if="playback.durationFormatted"> · {{ playback.durationFormatted }}</template>
        </span>
      </div>
      <p v-if="playback.tracks.length === 0" class="text-sm text-muted">Queue is empty.</p>
      <ol v-else class="m-0 list-none space-y-2 p-0">
        <li
          v-for="track in playback.tracks"
          :key="track.index"
          class="flex items-center gap-3 text-sm"
        >
          <span class="w-6 shrink-0 text-xs text-muted">{{ track.index }}</span>
          <span class="min-w-0 flex-1 truncate">{{ track.title }}</span>
          <span v-if="track.duration" class="shrink-0 text-xs text-muted">{{
            track.duration
          }}</span>
        </li>
      </ol>
      <p v-if="playback.pendingCount > playback.tracks.length" class="mt-2 text-xs text-muted">
        + {{ playback.pendingCount - playback.tracks.length }} more in queue
      </p>
    </div>
  </section>
</template>
