<script setup lang="ts">
  import { VisAxis, VisStackedBar, VisXYContainer } from '@unovis/vue';
  import { computed } from 'vue';

  import { ChartContainer, type ChartConfig } from '@/components/ui/chart';

  /** A small bar chart: one bar per label, coloured from the theme's primary token. */
  const props = defineProps<{
    labels: string[];
    values: number[];
    /** What a bar counts, for screen readers. */
    label: string;
    /** Show every n-th label on the axis (dense series such as 24 hours). */
    every?: number;
  }>();

  const config = {
    value: { label: props.label, color: 'var(--primary)' },
  } satisfies ChartConfig;

  interface Datum {
    index: number;
    value: number;
  }

  const data = computed<Datum[]>(() => props.values.map((value, index) => ({ index, value })));
  const ticks = computed(() =>
    props.labels.map((_, index) => index).filter((index) => index % (props.every ?? 1) === 0),
  );
  const summary = computed(() =>
    props.labels.map((name, index) => `${name} ${props.values[index] ?? 0}`).join(', '),
  );
</script>

<template>
  <figure class="min-w-0" :aria-label="`${label}: ${summary}`">
    <ChartContainer :config="config" class="aspect-auto h-40">
      <VisXYContainer :data="data" :margin="{ left: 4, right: 4 }" :padding="{ top: 8 }">
        <VisStackedBar
          :x="(d: Datum) => d.index"
          :y="(d: Datum) => d.value"
          color="var(--color-value)"
          :rounded-corners="3"
          :bar-padding="0.25"
        />
        <VisAxis
          type="x"
          :tick-values="ticks"
          :tick-format="(index: number) => labels[index] ?? ''"
          :grid-line="false"
          :domain-line="false"
          :tick-line="false"
        />
        <VisAxis type="y" :num-ticks="3" :domain-line="false" :tick-line="false" />
      </VisXYContainer>
    </ChartContainer>
  </figure>
</template>
