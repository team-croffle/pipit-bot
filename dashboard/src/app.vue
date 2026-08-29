<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { RouterLink, RouterView } from 'vue-router';

  import { fetchJson, logout } from './api';
  import type { DashboardIdentity } from './types';

  const me = ref<DashboardIdentity | null>(null);
  const error = ref('');

  const navClass =
    'rounded-full border border-transparent px-3 py-1.5 text-sm text-muted transition hover:border-line hover:bg-panel-hover hover:text-text';
  // WHY: "/" is a prefix of every route, so the home link has to match exactly or
  // it stays highlighted on the other pages.
  const navActiveClass =
    '[&.router-link-active]:border-accent/40 [&.router-link-active]:bg-accent-soft [&.router-link-active]:text-accent';
  const navExactActiveClass =
    '[&.router-link-exact-active]:border-accent/40 [&.router-link-exact-active]:bg-accent-soft [&.router-link-exact-active]:text-accent';

  onMounted(async () => {
    try {
      me.value = await fetchJson<DashboardIdentity>('/api/me');
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : 'Failed to load identity';
    }
  });
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 pb-14 pt-5">
    <header
      class="sticky top-0 z-10 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-soft bg-bg-elevated/90 px-4 py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-md"
    >
      <div>
        <h1 class="m-0 text-lg tracking-tight">Pipit</h1>
        <nav class="mt-2 flex flex-wrap gap-2">
          <RouterLink to="/" :class="[navClass, navExactActiveClass]">Overview</RouterLink>
          <RouterLink to="/settings" :class="[navClass, navActiveClass]">Settings</RouterLink>
          <RouterLink to="/github" :class="[navClass, navActiveClass]">GitHub</RouterLink>
        </nav>
      </div>
      <div
        v-if="me"
        class="flex flex-wrap items-center gap-2 rounded-xl border border-line-soft bg-panel px-3 py-2 text-sm"
      >
        <span>{{ me.user ?? 'anonymous' }}</span>
        <span
          class="rounded-full px-2 py-0.5 text-xs uppercase tracking-wide"
          :class="me.canWriteSettings ? 'bg-accent-soft text-accent' : 'bg-panel-hover text-muted'"
        >
          {{ me.canWriteSettings ? 'admin' : 'member' }}
        </span>
        <button
          type="button"
          class="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm text-muted transition hover:border-line hover:bg-panel-hover hover:text-text"
          @click="logout"
        >
          Log out
        </button>
      </div>
    </header>
    <p v-if="error" class="mb-4 text-sm text-bad">{{ error }}</p>
    <RouterView v-if="me" :me="me" />
  </div>
</template>
