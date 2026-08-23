<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { RouterLink, RouterView } from 'vue-router';

  import { fetchJson, logout } from './api';
  import type { DashboardIdentity } from './types';

  const me = ref<DashboardIdentity | null>(null);
  const error = ref('');

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
  <div class="shell">
    <header class="top">
      <div>
        <h1>Pipit</h1>
        <nav class="nav">
          <RouterLink to="/">Overview</RouterLink>
          <RouterLink to="/settings">Settings</RouterLink>
        </nav>
      </div>
      <div v-if="me" class="meta">
        <span
          >{{ me.user ?? 'anonymous' }} · {{ me.canWriteSettings ? 'admin' : 'view only' }}</span
        >
        <button class="ghost logout" type="button" @click="logout">Log out</button>
      </div>
    </header>
    <p v-if="error" class="error">{{ error }}</p>
    <RouterView v-if="me" :me="me" />
  </div>
</template>

<style scoped>
  .meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .logout {
    padding: 0.25rem 0.6rem;
    font-size: 0.85rem;
  }
</style>
