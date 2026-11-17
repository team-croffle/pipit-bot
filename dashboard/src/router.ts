import { createRouter, createWebHistory } from 'vue-router';

import Calendar from './views/calendar.vue';
import Github from './views/github.vue';
import Invites from './views/invites.vue';
import Login from './views/login.vue';
import Logs from './views/logs.vue';
import Music from './views/music.vue';
import Overview from './views/overview.vue';
import Polls from './views/polls.vue';
import ReactionRoles from './views/reaction-roles.vue';
import Settings from './views/settings.vue';
import Users from './views/users.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // The sign-in page stands alone: no shell, no /api/me (app.vue reads `bare`).
    { path: '/login', name: 'login', component: Login, meta: { bare: true } },
    { path: '/', name: 'overview', component: Overview },
    { path: '/music', name: 'music', component: Music },
    { path: '/github', name: 'github', component: Github },
    { path: '/invites', name: 'invites', component: Invites },
    { path: '/reaction-roles', name: 'reaction-roles', component: ReactionRoles },
    { path: '/settings', name: 'settings', component: Settings },
    { path: '/users', name: 'users', component: Users },
    // Planned features (ROADMAP.md). They render a preview so the navigation shows
    // where the work lands instead of growing a new shape later.
    {
      path: '/settlement',
      name: 'settlement',
      // The chart library is large; only this page needs it.
      component: () => import('./views/settlement.vue'),
    },
    { path: '/logs', name: 'logs', component: Logs },
    { path: '/calendar', name: 'calendar', component: Calendar },
    { path: '/polls', name: 'polls', component: Polls },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
