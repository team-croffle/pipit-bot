import {
  BarChart3,
  CalendarDays,
  Github,
  LayoutDashboard,
  ListChecks,
  Music,
  ScrollText,
  Settings,
  Users,
} from 'lucide-vue-next';
import type { Component } from 'vue';

export interface NavItem {
  to: string;
  label: string;
  icon: Component;
  /** Set on pages that exist as a preview of planned work rather than a live feature. */
  planned?: string;
  /** "/" is a prefix of every route, so the home link only matches exactly. */
  exact?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: '',
    items: [{ to: '/', label: '개요', icon: LayoutDashboard, exact: true }],
  },
  {
    title: '기능',
    items: [
      { to: '/music', label: '음악', icon: Music },
      { to: '/github', label: 'GitHub 리마인더', icon: Github },
      { to: '/calendar', label: '캘린더 연동', icon: CalendarDays, planned: 'v0.9' },
      { to: '/polls', label: '투표', icon: ListChecks, planned: 'v1.1' },
    ],
  },
  {
    title: '운영',
    items: [
      { to: '/settlement', label: '음악 결산', icon: BarChart3, planned: 'v0.8.1' },
      { to: '/logs', label: '로깅', icon: ScrollText, planned: 'v0.7.2' },
      { to: '/team', label: '팀 관리', icon: Users, planned: 'v0.6.7' },
    ],
  },
  {
    title: '시스템',
    items: [{ to: '/settings', label: '설정', icon: Settings }],
  },
];

export const navItems: NavItem[] = navSections.flatMap((section) => section.items);
