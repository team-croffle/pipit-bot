<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { RouterLink, RouterView } from 'vue-router';

  import { fetchJson } from './api';
  import type { DashboardIdentity } from './types';

  const me = ref<DashboardIdentity | null>(null);
  const error = ref('');

  onMounted(async () => {
    try {
      me.value = await fetchJson<DashboardIdentity>('/api/me');
    } catch (cause) {
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
      <p v-if="me" class="meta">
        {{ me.user ?? 'anonymous' }}
        ·
        {{ me.canWriteSettings ? 'admin' : 'view only' }}
      </p>
    </header>
    <p v-if="error" class="error">{{ error }}</p>
    <RouterView v-if="me" :me="me" />
  </div>
</template>
