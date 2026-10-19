<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { RouterLink } from 'vue-router';

  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import { Switch } from '@/components/ui/switch';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import { FEATURE_LIST, useFeatures, type Feature } from '@/composables/use-features';
  import type { DashboardIdentity } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;

  const { states, loadError, set, load } = useFeatures();
  const busy = ref<Feature | null>(null);
  const failure = ref('');

  /** Not built yet — shown so the list reads as the whole plan. */
  const planned = [
    { label: '음악 결산', to: '/settlement', version: 'v0.8.1' },
    { label: '캘린더 연동', to: '/calendar', version: 'v0.9' },
    { label: '투표 연동', to: '/polls', version: 'v0.10' },
  ];

  async function toggle(feature: Feature, on: boolean): Promise<void> {
    busy.value = feature;
    failure.value = await set(feature, on);
    busy.value = null;
  }

  onMounted(() => {
    if (!states.value) {
      void load();
    }
  });
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader title="설정" description="기본 동작, 채널, 기능별 on/off" />

    <p v-if="readOnly" class="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm">
      읽기 전용 계정입니다 — 설정을 변경할 수 없습니다.
    </p>

    <div class="flex flex-col gap-5">
      <Card>
        <CardContent class="flex flex-col">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium">명령 채널 제한</p>
              <p class="text-muted-foreground mt-1 text-xs">
                기능별로 나뉘어 각 기능 페이지에서 지정합니다. 음악은
                <RouterLink to="/music" class="underline underline-offset-2">
                  음악 페이지
                </RouterLink>
                의 재생 옵션 탭에서 설정하세요.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-base">기능별 on/off</CardTitle>
          <CardDescription>
            기능 단위로 켜고 끕니다. 끄면 그 기능의 디스코드 명령도 사라집니다(디스코드에 반영되는
            데 잠시 걸릴 수 있어요).
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col">
          <StateBlock :loading="!states && !loadError" :error="loadError">
            <div class="flex flex-col">
              <div
                v-for="feature in FEATURE_LIST"
                :key="feature.key"
                class="flex items-center justify-between gap-4 border-b py-3 first:pt-0 last:border-b-0"
              >
                <div class="min-w-0">
                  <RouterLink
                    :to="feature.to"
                    class="hover:text-primary truncate text-sm font-medium transition-colors"
                  >
                    {{ feature.label }}
                  </RouterLink>
                  <p class="text-muted-foreground mt-0.5 text-xs">{{ feature.help }}</p>
                </div>
                <Switch
                  :data-feature="feature.key"
                  :aria-label="feature.label"
                  :model-value="states?.[feature.key] ?? false"
                  :disabled="readOnly || busy !== null"
                  @update:model-value="(value) => toggle(feature.key, value === true)"
                />
              </div>
              <div
                v-for="item in planned"
                :key="item.label"
                class="flex items-center justify-between gap-4 border-b py-3 last:border-b-0 last:pb-0"
              >
                <RouterLink
                  :to="item.to"
                  class="text-muted-foreground hover:text-primary truncate text-sm transition-colors"
                >
                  {{ item.label }}
                </RouterLink>
                <div class="flex shrink-0 items-center gap-2.5">
                  <Badge variant="secondary">{{ item.version }} 예정</Badge>
                  <Switch disabled />
                </div>
              </div>
            </div>
          </StateBlock>
          <p v-if="failure" class="text-destructive mt-3 text-xs" role="alert" data-feature-error>
            {{ failure }}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-base">블로그 RSS 알림</CardTitle>
          <CardDescription>
            등록한 여러 블로그의 새 글을 채널 하나로 모아 링크와 함께 안내합니다.
          </CardDescription>
          <CardAction>
            <Badge variant="secondary">v0.10.0 예정</Badge>
          </CardAction>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="overflow-x-auto">
            <Table class="min-w-120">
              <TableHeader>
                <TableRow>
                  <TableHead>블로그</TableHead>
                  <TableHead>RSS 주소</TableHead>
                  <TableHead class="w-28">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell class="text-muted-foreground" colspan="3">
                    등록된 피드가 없습니다.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <Button variant="outline" size="sm" class="self-start" disabled>피드 추가</Button>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
