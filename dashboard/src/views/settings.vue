<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { RouterLink } from 'vue-router';

  import { fetchJson, putJson } from '@/api';
  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Separator } from '@/components/ui/separator';
  import { Switch } from '@/components/ui/switch';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import type { BotRuntimeConfig, DashboardIdentity } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;

  const prefix = ref('!');
  const loading = ref(true);
  const error = ref('');
  const saved = ref('');

  /**
   * Per-feature on/off is a v0.7.5 item, but the list is worth showing now: it is how
   * the operator will read at a glance what the bot is doing, and each row already
   * points at the page that governs it today.
   */
  const features = [
    { label: '음악', on: true, to: '/music' },
    { label: 'GitHub PR 리마인더', on: true, to: '/github' },
    { label: '초대 로거', on: true, to: '/invites' },
    { label: '리액션 롤', on: true, to: '/reaction-roles' },
    { label: '감사 로깅', on: false, to: '/logs' },
    { label: '음악 결산', on: false, to: '/settlement' },
    { label: '캘린더 연동', on: false, to: '/calendar' },
    { label: '투표 연동', on: false, to: '/polls' },
  ];

  onMounted(async () => {
    try {
      const config = await fetchJson<BotRuntimeConfig>('/api/config');
      prefix.value = config.prefix || '!';
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '설정을 불러오지 못했습니다.';
    } finally {
      loading.value = false;
    }
  });

  async function save(): Promise<void> {
    error.value = '';
    saved.value = '';
    if (!prefix.value.trim()) {
      error.value = '프리픽스는 비워둘 수 없습니다.';
      return;
    }

    try {
      // PUT /api/config is a patch — sending only the prefix leaves the music
      // channel list (edited on the music page) untouched.
      const config = await putJson<BotRuntimeConfig>('/api/config', { prefix: prefix.value });
      prefix.value = config.prefix || '!';
      saved.value = '저장했습니다.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '저장하지 못했습니다.';
    }
  }
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader title="설정" description="기본 동작, 채널, 기능별 on/off" />

    <p v-if="readOnly" class="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm">
      읽기 전용 계정입니다 — 설정을 변경할 수 없습니다.
    </p>

    <StateBlock :loading="loading">
      <div class="flex flex-col gap-5">
        <Alert v-if="error" variant="destructive">
          <AlertTitle>문제가 발생했습니다</AlertTitle>
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
        <Alert v-else-if="saved">
          <AlertDescription>{{ saved }}</AlertDescription>
        </Alert>

        <Card>
          <CardContent class="flex flex-col">
            <div class="flex items-center justify-between gap-4 py-4 first:pt-0">
              <div class="min-w-0">
                <Label for="prefix">명령어 프리픽스</Label>
                <p class="text-muted-foreground mt-1 text-xs">
                  슬래시 명령과 별개로 텍스트 명령에 사용합니다. 저장하면 즉시 적용됩니다.
                </p>
              </div>
              <Input
                id="prefix"
                v-model="prefix"
                :disabled="readOnly"
                placeholder="!"
                class="font-gothic w-20 shrink-0 text-center"
              />
            </div>
            <Separator />
            <div class="flex items-center justify-between gap-4 py-4 last:pb-0">
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
              기능 단위로 켜고 끕니다. 지금은 각 기능 페이지에서 개별로 관리합니다.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary">v0.7.5 예정</Badge>
            </CardAction>
          </CardHeader>
          <CardContent class="flex flex-col">
            <div
              v-for="feature in features"
              :key="feature.label"
              class="flex items-center justify-between gap-4 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
            >
              <RouterLink
                :to="feature.to"
                class="hover:text-primary min-w-0 truncate text-sm transition-colors"
              >
                {{ feature.label }}
              </RouterLink>
              <Switch :model-value="feature.on" disabled />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">블로그 RSS 알림</CardTitle>
            <CardDescription>
              등록한 여러 블로그의 새 글을 채널 하나로 모아 링크와 함께 안내합니다.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary">v1.0.1 예정</Badge>
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

        <div
          class="bg-background sticky bottom-0 -mx-1 flex justify-end rounded-t-xl border-t px-1 py-3 backdrop-blur-md"
        >
          <Button :disabled="readOnly" @click="save">저장</Button>
        </div>
      </div>
    </StateBlock>
  </div>
</template>
