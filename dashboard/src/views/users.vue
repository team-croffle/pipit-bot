<script setup lang="ts">
  import { Pencil, Plus } from 'lucide-vue-next';
  import { onMounted, ref } from 'vue';
  import { useI18n } from 'vue-i18n';

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
  import { methodLabel, type DashboardUser } from '@/lib/users';
  import type { DashboardIdentity } from '@/types';

  /**
   * Who is on the dashboard (v0.8.2). Everyone sees the list; admins add password
   * accounts, give or take admin, enter handles and passwords, and remove users. Admin is a
   * group — one the identity provider gives is changed there, not here.
   */

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;
  const { t } = useI18n();

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
      error.value = cause instanceof Error ? cause.message : t('users.loadFailed');
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
      failure.value = cause instanceof Error ? cause.message : t('users.changeFailed');
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
      return t('users.lockProvider');
    }
    if (user.id === me.userId && user.admin) {
      return t('users.lockSelf');
    }
    return null;
  }

  onMounted(load);
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader :title="t('users.title')" :description="t('users.description')" />

    <p v-if="readOnly" class="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm">
      {{ t('users.readOnly') }}
    </p>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">{{ t('users.title') }}</CardTitle>
        <CardDescription>
          {{ t('users.cardDescription') }}
        </CardDescription>
        <CardAction>
          <Button size="sm" :disabled="readOnly" data-user-add @click="adding = true">
            <Plus />
            {{ t('users.add') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-col">
        <StateBlock
          :loading="!users && !error"
          :error="users ? '' : error"
          :empty="users?.length === 0"
          :empty-text="t('users.empty')"
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
                  <Badge v-if="user.admin" data-admin-badge>{{ t('users.admin') }}</Badge>
                  <Badge v-if="user.id === me.userId" variant="outline">{{ t('users.me') }}</Badge>
                </div>
                <div class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge
                    v-for="method in user.methods"
                    :key="method"
                    variant="secondary"
                    class="font-normal"
                  >
                    {{ methodLabel(method) }}
                  </Badge>
                  <span v-if="user.methods.length === 0">{{ t('users.noMethods') }}</span>
                  <span v-if="user.githubLogin" class="font-gothic"
                    >GitHub {{ user.githubLogin }}</span
                  >
                  <span v-if="user.discordUserId">{{ t('users.discordLinked') }}</span>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-3 self-end sm:self-auto">
                <label
                  class="text-muted-foreground flex items-center gap-2 text-xs"
                  :title="adminLock(user) ?? ''"
                >
                  {{ t('users.admin') }}
                  <Switch
                    :aria-label="t('users.adminAria', { name: user.name })"
                    :model-value="user.admin"
                    :disabled="readOnly || busy !== null || Boolean(adminLock(user))"
                    data-admin-switch
                    @update:model-value="(value) => setAdmin(user, value === true)"
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  :aria-label="t('users.editAria', { name: user.name })"
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
