import { createContext } from 'reka-ui';
import type { Component, Ref } from 'vue';

export { default as ChartContainer } from './ChartContainer.vue';

// Format: { THEME_NAME: CSS_SELECTOR }
export const THEMES = { light: '', dark: '.dark' } as const;

export type ChartConfig = Record<
  string,
  {
    label?: string | Component;
    icon?: string | Component;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
>;

interface ChartContextProps {
  id: string;
  config: Ref<ChartConfig>;
}

export const [useChart, provideChartContext] = createContext<ChartContextProps>('Chart');

export { VisCrosshair as ChartCrosshair, VisTooltip as ChartTooltip } from '@unovis/vue';
