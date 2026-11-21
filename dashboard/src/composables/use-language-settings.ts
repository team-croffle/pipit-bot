import { ref } from 'vue';

import { fetchJson, putJson } from '@/api';

/**
 * The bot's language settings (data/language.json, /api/settings/language), shared by the
 * settings card and the per-feature selectors so a change shows everywhere at once.
 */

export type Language = 'en' | 'ko';
export type MessageFeature = 'github' | 'memberEvents' | 'reactionRoles' | 'music' | 'recap';

export interface LanguageSettings {
  dashboard: Language | null;
  messages: Language;
  features: Record<MessageFeature, Language | null>;
}

interface Answer {
  settings: LanguageSettings;
  loadError: string | null;
}

export const LANGUAGE_NAMES: Record<Language, string> = { ko: '한국어', en: 'English' };

const settings = ref<LanguageSettings | null>(null);
const loadError = ref('');
let loading: Promise<void> | null = null;

export function useLanguageSettings() {
  function load(): Promise<void> {
    loading ??= fetchJson<Answer>('/api/settings/language')
      .then((answer) => {
        settings.value = answer.settings;
        loadError.value = answer.loadError ?? '';
      })
      .catch((cause: unknown) => {
        loadError.value =
          cause instanceof Error ? cause.message : '언어 설정을 불러오지 못했습니다.';
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  /** Saves a change; returns the error message, or '' when it was saved. */
  async function save(change: Partial<LanguageSettings>): Promise<string> {
    if (!settings.value) {
      return '언어 설정을 아직 불러오지 못했습니다.';
    }
    const next: LanguageSettings = {
      ...settings.value,
      ...change,
      features: { ...settings.value.features, ...change.features },
    };
    try {
      settings.value = (await putJson<Answer>('/api/settings/language', next)).settings;
      return '';
    } catch (cause) {
      return cause instanceof Error ? cause.message : '저장하지 못했습니다.';
    }
  }

  return { settings, loadError, load, save };
}
