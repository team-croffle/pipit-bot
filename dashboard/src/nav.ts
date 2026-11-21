import {
  BarChart3,
  CalendarDays,
  Github,
  LayoutDashboard,
  ListChecks,
  Music,
  ScrollText,
  Settings,
  Smile,
  UserPlus,
  Users,
} from 'lucide-vue-next';
import type { Component } from 'vue';

export interface NavItem {
  to: string;
  /** An i18n key (nav.*). */
  label: string;
  icon: Component;
  /** Set on pages that exist as a preview of planned work rather than a live feature. */
  planned?: string;
  /** "/" is a prefix of every route, so the home link only matches exactly. */
  exact?: boolean;
}

export interface NavSection {
  /** An i18n key, or '' for none. */
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: '',
    items: [{ to: '/', label: 'nav.overview', icon: LayoutDashboard, exact: true }],
  },
  {
    title: 'nav.features',
    items: [
      { to: '/music', label: 'nav.music', icon: Music },
      { to: '/github', label: 'nav.github', icon: Github },
      { to: '/invites', label: 'nav.invites', icon: UserPlus },
      { to: '/reaction-roles', label: 'nav.reactionRoles', icon: Smile },
      { to: '/calendar', label: 'nav.calendar', icon: CalendarDays, planned: 'v0.9' },
      { to: '/polls', label: 'nav.polls', icon: ListChecks, planned: 'v0.10' },
    ],
  },
  {
    title: 'nav.operations',
    items: [
      { to: '/settlement', label: 'nav.settlement', icon: BarChart3 },
      { to: '/logs', label: 'nav.logs', icon: ScrollText },
    ],
  },
  {
    title: 'nav.system',
    items: [
      { to: '/users', label: 'nav.users', icon: Users },
      { to: '/settings', label: 'nav.settings', icon: Settings },
    ],
  },
];

export const navItems: NavItem[] = navSections.flatMap((section) => section.items);
