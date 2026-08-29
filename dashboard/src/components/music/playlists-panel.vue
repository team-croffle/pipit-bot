<script setup lang="ts">
  import { ListMusic, Plus } from 'lucide-vue-next';

  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent } from '@/components/ui/card';
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-muted-foreground text-sm">
        서버 멤버가 만든 재생목록을 저장하고 한 번에 재생합니다.
      </p>
      <div class="flex items-center gap-2">
        <Badge variant="secondary">v0.7.3 예정</Badge>
        <Button variant="outline" size="sm" disabled>
          <Plus />
          새 재생목록
        </Button>
      </div>
    </div>

    <Card class="border-dashed">
      <CardContent class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div class="bg-muted text-muted-foreground rounded-xl p-3">
          <ListMusic class="size-6" />
        </div>
        <div class="min-w-0">
          <p class="font-medium">아직 구현되지 않은 기능입니다.</p>
          <p class="text-muted-foreground mt-1 text-sm">
            재생목록 저장·재생은 로드맵 v0.7.3에 계획되어 있습니다. 지금은 대기열만 사용할 수
            있습니다.
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
