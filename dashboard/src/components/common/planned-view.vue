<script setup lang="ts">
  import type { Component } from 'vue';

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
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader :title="title" :description="description">
      <template #actions>
        <Badge variant="secondary">{{ version }} 예정</Badge>
      </template>
    </PageHeader>

    <Card class="border-dashed">
      <CardContent class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div class="bg-muted text-muted-foreground rounded-xl p-3">
          <component :is="icon" class="size-6" />
        </div>
        <div class="min-w-0">
          <p class="font-medium">아직 구현되지 않은 기능입니다.</p>
          <p class="text-muted-foreground mt-1 text-sm">
            로드맵 {{ version }}에 계획되어 있습니다. 이 화면은 자리를 잡아 두기 위한 것으로, 실제
            동작은 하지 않습니다.
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent>
        <p class="mb-3 text-sm font-medium">계획된 내용</p>
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
