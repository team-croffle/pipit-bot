import { createRouter, createWebHistory } from 'vue-router';

import Overview from './views/overview.vue';
import Settings from './views/settings.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'overview', component: Overview },
    { path: '/settings', name: 'settings', component: Settings },
  ],
});
