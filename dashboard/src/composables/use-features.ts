import { ref } from 'vue';

import { fetchJson, putJson } from '@/api';

export type Feature =
  | 'music'
  | 'github'
  | 'audit'
  | 'invites'
  | 'memberMessages'
  | 'joinRoles'
  | 'reactionRoles';

export const FEATURE_LIST: { key: Feature; label: string; help: string; to: string }[] = [
  {
    key: 'music',
    label: '음악',
    help: '끄면 재생을 멈추고 통화방에서 나가며, 음악 명령이 사라집니다.',
    to: '/music',
  },
  {
    key: 'github',
    label: 'GitHub 알림',
    help: 'PR·이슈 알림과 /remind. GitHub 페이지의 전체 스위치와 같습니다.',
    to: '/github',
  },
  {
    key: 'audit',
    label: '감사 로깅',
    help: '끄는 동안의 조작은 기록하지 않습니다(끈 사실은 남습니다).',
    to: '/logs',
  },
  { key: 'invites', label: '초대 추적', help: '초대 코드별 유입과 기록 채널.', to: '/invites' },
  {
    key: 'memberMessages',
    label: '입장·퇴장 메시지',
    help: '안내 채널에 보내는 입장·퇴장 메시지.',
    to: '/invites',
  },
  { key: 'joinRoles', label: '입장 역할', help: '들어온 멤버에게 주는 역할.', to: '/invites' },
  {
    key: 'reactionRoles',
    label: '리액션 롤',
    help: '끄면 패널은 그대로 두고 반응해도 역할을 주지 않습니다.',
    to: '/reaction-roles',
  },
];

/** Which switches govern a page — the notice above it names the ones that are off. */
export const PAGE_FEATURES: Record<string, Feature[]> = {
  '/music': ['music'],
  '/github': ['github'],
  '/logs': ['audit'],
  '/invites': ['invites', 'memberMessages', 'joinRoles'],
  '/reaction-roles': ['reactionRoles'],
};

/** The sidebar dims an item whose main feature is off. */
export const NAV_FEATURE: Record<string, Feature> = {
  '/music': 'music',
  '/github': 'github',
  '/logs': 'audit',
  '/invites': 'invites',
  '/reaction-roles': 'reactionRoles',
};

/** One copy for the whole app: the sidebar, the page notice and the settings page share it. */
const states = ref<Record<Feature, boolean> | null>(null);
const loadError = ref('');

async function load(): Promise<void> {
  try {
    states.value = (
      await fetchJson<{ features: Record<Feature, boolean> }>('/api/settings/features')
    ).features;
    loadError.value = '';
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : '기능 상태를 불러오지 못했습니다.';
  }
}

/** Returns an error message, or '' when the switch moved. */
async function set(feature: Feature, on: boolean): Promise<string> {
  try {
    states.value = (
      await putJson<{ features: Record<Feature, boolean> }>('/api/settings/features', {
        feature,
        on,
      })
    ).features;
    return '';
  } catch (cause) {
    return cause instanceof Error ? cause.message : '바꾸지 못했습니다.';
  }
}

function isOff(feature: Feature): boolean {
  return states.value?.[feature] === false;
}

export function useFeatures() {
  return { states, loadError, load, set, isOff };
}
