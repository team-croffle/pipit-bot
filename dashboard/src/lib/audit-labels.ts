import { t } from '@/i18n';
import { logs } from '@/i18n/locales/en/logs';
import type { AuditCategory, AuditEntry } from '@/types';

/** Labels are looked up at call time, so a change of language is reflected. */
export const CATEGORIES = Object.keys(logs.category) as AuditCategory[];

export function categoryLabel(category: string): string {
  return Object.hasOwn(logs.category, category) ? t(`logs.category.${category}`) : category;
}

export function outcomeLabel(outcome: AuditEntry['outcome']): string {
  return t(`logs.outcome.${outcome}`);
}

/**
 * Recorded names (`music.pause`, `music:vol-down`) as resource keys: dots, colons and
 * dashes would read as a path, so they become underscores.
 */
function resourceKey(name: string): string {
  return name.replace(/[.:-]/g, '_');
}

/**
 * `2026.10.20. 15:04:05` in the reader's own time — padded so the column lines up, and
 * exact, because a log is read to find out when something happened.
 */
export function timestamp(at: string): string {
  const time = new Date(at);
  const pad = (value: number): string => String(value).padStart(2, '0');
  const day = `${time.getFullYear()}.${pad(time.getMonth() + 1)}.${pad(time.getDate())}.`;
  return `${day} ${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
}

/** Switching a feature records its key and `on`/`off`; both read better as words. */
export function targetLabel(entry: AuditEntry): string | undefined {
  if (entry.action === 'features.update' && entry.target) {
    return Object.hasOwn(logs.feature, entry.target)
      ? t(`logs.feature.${entry.target}`)
      : entry.target;
  }

  if (entry.action === 'audit.settings' && entry.target === 'musicRequests') {
    return t('logs.musicRequests');
  }

  return entry.target;
}

export function detailLabel(entry: AuditEntry): string | undefined {
  if (
    (entry.action === 'features.update' || entry.action === 'audit.settings') &&
    (entry.detail === 'on' || entry.detail === 'off')
  ) {
    return entry.detail === 'on' ? t('logs.on') : t('logs.off');
  }

  return entry.detail;
}

/** A person-readable name for an action; unknown actions are shown as recorded. */
export function actionLabel(action: string): string {
  const key = resourceKey(action);
  if (Object.hasOwn(logs.action, key)) {
    return t(`logs.action.${key}`);
  }

  const control = /^(button|modal|select):(.+)$/.exec(action);
  if (control) {
    const name = resourceKey(control[2]!);
    return Object.hasOwn(logs.control, name)
      ? t('logs.remote', { name: t(`logs.control.${name}`) })
      : action;
  }

  return action;
}
