import { createRouter, createWebHistory } from 'vue-router';

import Calendar from './views/calendar.vue';
import Github from './views/github.vue';
import Logs from './views/logs.vue';
import Music from './views/music.vue';
import Overview from './views/overview.vue';
import Polls from './views/polls.vue';
import Settings from './views/settings.vue';
import Settlement from './views/settlement.vue';
import Team from './views/team.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'overview', component: Overview },
    { path: '/music', name: 'music', component: Music },
    { path: '/github', name: 'github', component: Github },
    { path: '/settings', name: 'settings', component: Settings },
    // Planned features (ROADMAP.md). They render a preview so the navigation shows
    // where the work lands instead of growing a new shape later.
    { path: '/settlement', name: 'settlement', component: Settlement },
    { path: '/logs', name: 'logs', component: Logs },
    { path: '/team', name: 'team', component: Team },
    { path: '/calendar', name: 'calendar', component: Calendar },
    { path: '/polls', name: 'polls', component: Polls },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
