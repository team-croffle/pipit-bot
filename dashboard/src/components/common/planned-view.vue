<script setup lang="ts">
  import type { Component } from 'vue';
  import { useI18n } from 'vue-i18n';

  import { Badge } from '@/components/ui/badge';
  import { Card, CardContent } from '@/components/ui/card';

  import PageHeader from './page-header.vue';

  defineProps<{
    title: string;
    description: string;
    version: string;
    icon: Component;
    points: string[];
  }>();
  const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader :title="title" :description="description">
      <template #actions>
        <Badge variant="secondary">{{ t('common.plannedBadge', { version }) }}</Badge>
      </template>
    </PageHeader>

    <Card class="border-dashed">
      <CardContent class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div class="bg-muted text-muted-foreground rounded-xl p-3">
          <component :is="icon" class="size-6" />
        </div>
        <div class="min-w-0">
          <p class="font-medium">{{ t('common.plannedTitle') }}</p>
          <p class="text-muted-foreground mt-1 text-sm">
            {{ t('common.plannedBody', { version }) }}
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent>
        <p class="mb-3 text-sm font-medium">{{ t('common.plannedList') }}</p>
        <ul class="text-muted-foreground flex list-none flex-col gap-2 p-0 text-sm">
          <li v-for="point in points" :key="point" class="flex gap-2.5">
            <span class="bg-muted-foreground/50 mt-2 size-1.5 shrink-0 rounded-full" />
            <span>{{ point }}</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
