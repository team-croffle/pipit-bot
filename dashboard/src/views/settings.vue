<script setup lang="ts">
  import type { DashboardIdentity } from '../types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;
</script>

<template>
  <div class="grid">
    <p v-if="readOnly" class="banner">View only — you can open settings but cannot save changes.</p>
    <section class="card">
      <h2>Bot settings</h2>
      <p class="empty">
        Prefix, command channel, and RSS registration will be wired after the Discord config
        commands land.
      </p>
      <div class="field">
        <label for="prefix">Command prefix</label>
        <input id="prefix" value="!" disabled placeholder="Coming soon" />
      </div>
      <div class="field">
        <label for="channel">Command channel</label>
        <input id="channel" disabled placeholder="Coming soon" />
      </div>
      <div class="field">
        <label for="rss">Blog RSS feed</label>
        <input id="rss" disabled placeholder="Coming soon" />
      </div>
      <button class="primary" type="button" :disabled="readOnly">Save</button>
    </section>
  </div>
</template>
