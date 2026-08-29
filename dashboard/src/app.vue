<script setup lang="ts">
  import { LogOut, Menu } from 'lucide-vue-next';
  import { computed, onMounted, ref, watch } from 'vue';
  import { RouterView, useRoute } from 'vue-router';

  import { fetchJson, logout } from './api';
  import AppSidebar from './components/layout/app-sidebar.vue';
  import BrandMark from './components/layout/brand-mark.vue';
  import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
  import { Badge } from './components/ui/badge';
  import { Button } from './components/ui/button';
  import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
    SheetTrigger,
  } from './components/ui/sheet';
  import { Skeleton } from './components/ui/skeleton';
  import type { DashboardIdentity, HealthResponse } from './types';

  const me = ref<DashboardIdentity | null>(null);
  const error = ref('');
  const loading = ref(true);
  const health = ref<'ok' | 'error' | 'unknown'>('unknown');
  const mobileNavOpen = ref(false);

  const route = useRoute();

  const healthLabel = computed(() => {
    if (health.value === 'ok') {
      return '온라인';
    }

    return health.value === 'error' ? '응답 없음' : '확인 중';
  });

  // Closing on navigation keeps the drawer from covering the page it just opened.
  watch(
    () => route.fullPath,
    () => {
      mobileNavOpen.value = false;
    },
  );

  onMounted(async () => {
    try {
      me.value = await fetchJson<DashboardIdentity>('/api/me');
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Redirecting to login')) {
        return;
      }
      error.value = cause instanceof Error ? cause.message : '로그인 정보를 불러오지 못했습니다.';
    } finally {
      loading.value = false;
    }

    try {
      const body = await fetchJson<HealthResponse>('/api/health');
      health.value = body.status === 'ok' ? 'ok' : 'error';
    } catch {
      health.value = 'error';
    }
  });
</script>

<template>
  <div class="bg-background flex min-h-dvh">
    <aside
      class="border-sidebar-border bg-sidebar sticky top-0 hidden h-dvh w-60 shrink-0 border-r lg:block"
    >
      <AppSidebar version="v0.6.4-dev" />
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="bg-background/85 sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-md sm:px-6"
      >
        <Sheet v-model:open="mobileNavOpen">
          <SheetTrigger as-child>
            <Button variant="ghost" size="icon" class="lg:hidden" aria-label="메뉴 열기">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" class="w-64 p-0">
            <SheetTitle class="sr-only">내비게이션</SheetTitle>
            <SheetDescription class="sr-only">대시보드 페이지 목록</SheetDescription>
            <AppSidebar version="v0.6.4-dev" @navigate="mobileNavOpen = false" />
          </SheetContent>
        </Sheet>

        <BrandMark :size="28" class="lg:hidden" />

        <div class="ml-auto flex items-center gap-2 sm:gap-3">
          <Badge variant="outline" class="gap-1.5 font-normal" :title="`API 상태: ${healthLabel}`">
            <span
              class="size-1.5 rounded-full"
              :class="{
                'bg-success': health === 'ok',
                'bg-destructive': health === 'error',
                'bg-muted-foreground': health === 'unknown',
              }"
              aria-hidden="true"
            />
            <span class="hidden sm:inline">Croffle Dev · </span>{{ healthLabel }}
          </Badge>

          <Skeleton v-if="loading" class="h-8 w-28" />
          <template v-else-if="me">
            <div class="flex items-center gap-2">
              <span class="hidden max-w-32 truncate text-sm sm:inline">
                {{ me.user ?? 'anonymous' }}
              </span>
              <Badge :variant="me.canWriteSettings ? 'default' : 'secondary'">
                {{ me.canWriteSettings ? 'admin' : 'member' }}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" aria-label="로그아웃" @click="logout">
              <LogOut />
            </Button>
          </template>
        </div>
      </header>

      <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Alert v-if="error" variant="destructive" class="mb-5">
          <AlertTitle>불러오지 못했습니다</AlertTitle>
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <div v-else-if="loading" class="flex flex-col gap-4">
          <Skeleton class="h-8 w-56" />
          <Skeleton class="h-28 w-full" />
          <Skeleton class="h-56 w-full" />
        </div>

        <RouterView v-else-if="me" :me="me" />
      </main>
    </div>
  </div>
</template>
