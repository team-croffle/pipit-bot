import { createRouter, createWebHistory } from 'vue-router';

import Github from './views/github.vue';
import Overview from './views/overview.vue';
import Settings from './views/settings.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'overview', component: Overview },
    { path: '/settings', name: 'settings', component: Settings },
    { path: '/github', name: 'github', component: Github },
  ],
});
