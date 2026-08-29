import { useColorMode } from '@vueuse/core';
import { computed } from 'vue';

export type ThemeChoice = 'auto' | 'light' | 'dark';

/**
 * `auto` follows `prefers-color-scheme`; picking light or dark pins it and is
 * remembered per browser. useColorMode keeps the class on <html> in step, which is
 * what the `dark:` variant in styles.css hangs off.
 */
export function useTheme() {
  const mode = useColorMode({
    storageKey: 'pipit-theme',
    emitAuto: true,
    disableTransition: false,
  });

  const choices: { value: ThemeChoice; label: string }[] = [
    { value: 'light', label: '라이트' },
    { value: 'dark', label: '다크' },
    { value: 'auto', label: '시스템' },
  ];

  const current = computed<ThemeChoice>(() => mode.value as ThemeChoice);

  function set(choice: ThemeChoice): void {
    mode.value = choice;
  }

  return { current, choices, set };
}
