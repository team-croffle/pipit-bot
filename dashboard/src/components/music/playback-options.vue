<script setup lang="ts">
  import { Badge } from '@/components/ui/badge';
  import { Card, CardContent } from '@/components/ui/card';
  import { Label } from '@/components/ui/label';
  import { Switch } from '@/components/ui/switch';

  /** Options the player does not expose yet — each one is tied to a roadmap version. */
  const options = [
    {
      key: 'mono',
      label: '모노 스트리밍',
      help: '이어폰을 한쪽만 낄 때를 위해 좌우 채널을 합쳐 내보냅니다.',
      version: 'v0.7.4',
    },
    {
      key: 'autoplay',
      label: '자동 재생',
      help: '대기열이 비어도 이어질 트랙을 자동으로 채웁니다.',
      version: 'v0.7.4',
    },
    {
      key: 'repeat-default',
      label: '반복 재생 기본값',
      help: '새 세션이 시작될 때 적용할 반복 모드입니다.',
      version: 'v0.7.5',
    },
  ];
</script>

<template>
  <Card>
    <CardContent class="flex flex-col">
      <div
        v-for="option in options"
        :key="option.key"
        class="flex items-center justify-between gap-4 border-b py-4 first:pt-0 last:border-b-0 last:pb-0"
      >
        <div class="min-w-0">
          <Label :for="`opt-${option.key}`" class="text-muted-foreground">{{ option.label }}</Label>
          <p class="text-muted-foreground mt-1 text-xs">{{ option.help }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2.5">
          <Badge variant="secondary">{{ option.version }} 예정</Badge>
          <Switch :id="`opt-${option.key}`" disabled />
        </div>
      </div>
    </CardContent>
  </Card>
</template>
