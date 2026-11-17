<script setup lang="ts">
  import { Pencil, Plus } from 'lucide-vue-next';
  import { onMounted, ref } from 'vue';

  import { fetchJson, patchJson } from '@/api';
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
  import UserAddDialog from '@/components/users/user-add-dialog.vue';
  import UserEditDialog from '@/components/users/user-edit-dialog.vue';
  import { METHOD_LABELS, type DashboardUser } from '@/lib/users';
  import type { DashboardIdentity } from '@/types';

  /**
   * Who is on the dashboard (v0.8.2). Everyone sees the list; admins add password
   * accounts, give or take admin, enter handles and passwords, and remove users. Admin is a
   * group — one the identity provider gives is changed there, not here.
   */

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;

  const users = ref<DashboardUser[] | null>(null);
  const error = ref('');
  const failure = ref('');
  const busy = ref<string | null>(null);
  const adding = ref(false);
  const editing = ref<DashboardUser | null>(null);
  const editOpen = ref(false);

  async function load(): Promise<void> {
    try {
      users.value = (await fetchJson<{ users: DashboardUser[] }>('/api/users')).users;
      error.value = '';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '사용자를 불러오지 못했습니다.';
    }
  }

  async function setAdmin(user: DashboardUser, on: boolean): Promise<void> {
    busy.value = user.id;
    failure.value = '';
    try {
      users.value = (
        await patchJson<{ users: DashboardUser[] }>(`/api/users/${user.id}`, { admin: on })
      ).users;
    } catch (cause) {
      failure.value = cause instanceof Error ? cause.message : '바꾸지 못했습니다.';
    } finally {
      busy.value = null;
    }
  }

  function edit(user: DashboardUser): void {
    editing.value = user;
    editOpen.value = true;
  }

  function adminLock(user: DashboardUser): string | null {
    if (user.adminByProvider) {
      return 'ID 제공자 그룹으로 관리자 — 그쪽에서 바꿉니다';
    }
    if (user.id === me.userId && user.admin) {
      return '자기 자신의 관리자 권한은 뺄 수 없습니다';
    }
    return null;
  }

  onMounted(load);
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader title="사용자" description="대시보드에 들어오는 사람과 로그인 방법, 권한" />

    <p v-if="readOnly" class="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm">
      읽기 전용 계정입니다 — 사용자를 바꿀 수 없습니다.
    </p>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">사용자</CardTitle>
        <CardDescription>
          관리자 권한은 그룹입니다. 여기서 주거나 빼고, SSO 그룹으로 받은 권한은 ID 제공자에서
          바꿉니다. GitHub 로그인·디스코드 계정은 멘션과 개인 재생목록·결산에 쓰입니다.
        </CardDescription>
        <CardAction>
          <Button size="sm" :disabled="readOnly" data-user-add @click="adding = true">
            <Plus />
            사용자 추가
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-col">
        <StateBlock
          :loading="!users && !error"
          :error="users ? '' : error"
          :empty="users?.length === 0"
          empty-text="사용자가 없습니다."
        >
          <ul class="flex flex-col">
            <li
              v-for="user in users ?? []"
              :key="user.id"
              class="flex flex-col gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              :data-user-row="user.username ?? user.name"
            >
              <div class="flex min-w-0 flex-col gap-1">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <span class="truncate text-sm font-medium">{{ user.name }}</span>
                  <span
                    v-if="user.username && user.username !== user.name"
                    class="text-muted-foreground font-gothic truncate text-xs"
                  >
                    @{{ user.username }}
                  </span>
                  <Badge v-if="user.admin" data-admin-badge>관리자</Badge>
                  <Badge v-if="user.id === me.userId" variant="outline">나</Badge>
                </div>
                <div class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge
                    v-for="method in user.methods"
                    :key="method"
                    variant="secondary"
                    class="font-normal"
                  >
                    {{ METHOD_LABELS[method] ?? method }}
                  </Badge>
                  <span v-if="user.methods.length === 0">로그인 수단 없음</span>
                  <span v-if="user.githubLogin" class="font-gothic"
                    >GitHub {{ user.githubLogin }}</span
                  >
                  <span v-if="user.discordUserId">· 디스코드 연결됨</span>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-3 self-end sm:self-auto">
                <label
                  class="text-muted-foreground flex items-center gap-2 text-xs"
                  :title="adminLock(user) ?? ''"
                >
                  관리자
                  <Switch
                    :aria-label="`${user.name} 관리자`"
                    :model-value="user.admin"
                    :disabled="readOnly || busy !== null || Boolean(adminLock(user))"
                    data-admin-switch
                    @update:model-value="(value) => setAdmin(user, value === true)"
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  :aria-label="`${user.name} 편집`"
                  :disabled="readOnly"
                  data-user-edit
                  @click="edit(user)"
                >
                  <Pencil />
                </Button>
              </div>
            </li>
          </ul>
        </StateBlock>
        <p v-if="failure" class="text-destructive mt-3 text-xs" role="alert">{{ failure }}</p>
      </CardContent>
    </Card>

    <UserAddDialog v-model:open="adding" @saved="(next) => (users = next)" />
    <UserEditDialog
      v-model:open="editOpen"
      :user="editing"
      :is-self="editing?.id === me.userId"
      @saved="(next) => (users = next)"
    />
  </div>
</template>
