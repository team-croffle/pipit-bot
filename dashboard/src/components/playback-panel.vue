<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue';

  import { fetchJson, postJson } from '../api';
  import type { PlaybackActionResult, PlaybackState } from '../types';

  const playback = ref<PlaybackState | null>(null);
  const query = ref('');
  const error = ref('');
  const actionMessage = ref('');
  const busy = ref(false);
  let timer: ReturnType<typeof setInterval> | undefined;

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

  async function enqueue(): Promise<void> {
    const trimmed = query.value.trim();
    if (!trimmed) {
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
      actionMessage.value = 'Preparing track… It will play when the bot is in a voice channel.';
      error.value = '';
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : 'Failed to enqueue';
    } finally {
      busy.value = false;
    }
  }

  function statusLabel(state: PlaybackState): string {
    if (!state.active) {
      return 'idle';
    }
    return state.paused ? 'paused' : 'playing';
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
  <section class="card playback-card">
    <div class="card-head">
      <h2>Playback</h2>
      <span v-if="playback" class="status-pill" :class="statusLabel(playback)">
        {{ statusLabel(playback) }}
      </span>
    </div>

    <form class="enqueue" @submit.prevent="enqueue">
      <input v-model="query" type="text" placeholder="Search or paste a query…" :disabled="busy" />
      <button class="primary" type="submit" :disabled="busy || !query.trim()">Play</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="actionMessage" class="hint">{{ actionMessage }}</p>

    <div v-if="playback?.active && playback.current" class="now-playing">
      <p class="track-title">{{ playback.current.title }}</p>
      <div class="progress-track" aria-hidden="true">
        <div
          class="progress-fill"
          :style="{ width: `${Math.round(playback.current.progress * 100)}%` }"
        ></div>
      </div>
      <p class="progress-labels">
        <span>{{ playback.current.positionLabel }}</span>
        <span>{{ playback.current.durationLabel }}</span>
      </p>
      <p v-if="playback.voiceChannelName" class="hint">
        Voice: {{ playback.voiceChannelName }}
        <span v-if="playback.repeatMode !== 'off'"> · repeat {{ playback.repeatMode }}</span>
      </p>
    </div>
    <p v-else class="empty">Nothing playing. Enqueue a track above or use Discord commands.</p>

    <div class="transport">
      <button
        class="ghost"
        type="button"
        :disabled="busy || !playback?.active || playback.paused"
        @click="runAction('/api/music/playback/pause')"
      >
        Pause
      </button>
      <button
        class="ghost"
        type="button"
        :disabled="busy || !playback?.active || !playback.paused"
        @click="runAction('/api/music/playback/resume')"
      >
        Resume
      </button>
      <button
        class="ghost"
        type="button"
        :disabled="busy || !playback?.active"
        @click="runAction('/api/music/playback/skip')"
      >
        Skip
      </button>
    </div>

    <div v-if="playback?.active" class="queue">
      <div class="queue-head">
        <h3>Up next</h3>
        <span class="muted">
          {{ playback.pendingCount }} track{{ playback.pendingCount === 1 ? '' : 's' }}
          <template v-if="playback.durationFormatted"> · {{ playback.durationFormatted }}</template>
        </span>
      </div>
      <p v-if="playback.tracks.length === 0" class="empty">Queue is empty.</p>
      <ol v-else class="queue-list">
        <li v-for="track in playback.tracks" :key="track.index">
          <span class="queue-index">{{ track.index }}</span>
          <span class="queue-title">{{ track.title }}</span>
          <span v-if="track.duration" class="muted">{{ track.duration }}</span>
        </li>
      </ol>
      <p v-if="playback.pendingCount > playback.tracks.length" class="hint">
        + {{ playback.pendingCount - playback.tracks.length }} more in queue
      </p>
    </div>
  </section>
</template>
