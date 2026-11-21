import { ref } from 'vue';

import { fetchJson, putJson } from '@/api';
import { t } from '@/i18n';

export type Feature =
  | 'music'
  | 'github'
  | 'audit'
  | 'invites'
  | 'memberMessages'
  | 'joinRoles'
  | 'reactionRoles';

interface FeatureItem {
  key: Feature;
  label: string;
  help: string;
  to: string;
}

/** One switch; label and help are getters so they follow a change of language. */
function featureItem(key: Feature, to: string): FeatureItem {
  return {
    key,
    to,
    get label() {
      return t(`features.${key}.label`);
    },
    get help() {
      return t(`features.${key}.help`);
    },
  };
}

export const FEATURE_LIST: FeatureItem[] = [
  featureItem('music', '/music'),
  featureItem('github', '/github'),
  featureItem('audit', '/logs'),
  featureItem('invites', '/invites'),
  featureItem('memberMessages', '/invites'),
  featureItem('joinRoles', '/invites'),
  featureItem('reactionRoles', '/reaction-roles'),
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
    loadError.value = cause instanceof Error ? cause.message : t('features.loadFailed');
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
    return cause instanceof Error ? cause.message : t('features.setFailed');
  }
}

function isOff(feature: Feature): boolean {
  return states.value?.[feature] === false;
}

export function useFeatures() {
  return { states, loadError, load, set, isOff };
}
