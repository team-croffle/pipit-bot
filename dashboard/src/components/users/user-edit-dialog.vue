<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useI18n } from 'vue-i18n';

  import { deleteJson, fetchJson, patchJson, postJson } from '@/api';
  import MemberSelect from '@/components/common/member-select.vue';
  import { Button } from '@/components/ui/button';
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Separator } from '@/components/ui/separator';
  import { passwordHint, type DashboardUser } from '@/lib/users';
  import type { DiscordMember } from '@/types';

  /**
   * One user: the handles they are known by (an admin enters them when a sign-in could
   * not link them on its own), a new password, or removing them.
   */

  const open = defineModel<boolean>('open', { required: true });
  const { user, isSelf } = defineProps<{ user: DashboardUser | null; isSelf: boolean }>();
  const emit = defineEmits<{ saved: [DashboardUser[]] }>();
  const { t } = useI18n();

  const githubLogin = ref('');
  const discordUserId = ref('');
  const password = ref('');
  const confirmDelete = ref(false);
  const busy = ref(false);
  const error = ref('');
  const members = ref<DiscordMember[]>([]);
  const membersLoading = ref(false);

  const hint = computed(() => (password.value ? passwordHint(password.value) : null));

  watch(open, (now) => {
    if (now && user) {
      githubLogin.value = user.githubLogin ?? '';
      discordUserId.value = user.discordUserId ?? '';
      password.value = '';
      confirmDelete.value = false;
      error.value = '';
    }
  });

  async function loadMembers(): Promise<void> {
    if (members.value.length > 0 || membersLoading.value) {
      return;
    }
    membersLoading.value = true;
    try {
      members.value = (
        await fetchJson<{ members: DiscordMember[] }>('/api/discord/members')
      ).members;
    } catch {
      // The picker still shows the saved id.
    } finally {
      membersLoading.value = false;
    }
  }

  async function run(work: () => Promise<{ users: DashboardUser[] }>, close = true): Promise<void> {
    busy.value = true;
    error.value = '';
    try {
      emit('saved', (await work()).users);
      if (close) {
        open.value = false;
      }
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : t('users.editDialog.failed');
    } finally {
      busy.value = false;
    }
  }

  const saveHandles = () =>
    run(() =>
      patchJson(`/api/users/${user!.id}`, {
        githubLogin: githubLogin.value.trim() || null,
        discordUserId: discordUserId.value || null,
      }),
    );
  const savePassword = () =>
    run(() => postJson(`/api/users/${user!.id}/password`, { password: password.value }));
  const remove = () => run(() => deleteJson(`/api/users/${user!.id}`));
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="user" class="sm:max-w-md [&>*]:min-w-0" data-user-edit-dialog>
      <DialogHeader>
        <DialogTitle>{{ user.name }}</DialogTitle>
        <DialogDescription>
          {{ t('users.editDialog.description') }}
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="saveHandles">
        <div class="flex flex-col gap-2">
          <Label for="user-edit-github">{{ t('users.editDialog.github') }}</Label>
          <Input
            id="user-edit-github"
            v-model="githubLogin"
            :placeholder="t('users.editDialog.none')"
            autocapitalize="none"
            spellcheck="false"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="user-edit-discord">{{ t('users.editDialog.discord') }}</Label>
          <MemberSelect
            id="user-edit-discord"
            v-model="discordUserId"
            :members="members"
            :loading="membersLoading"
            @open="loadMembers"
          />
          <button
            v-if="discordUserId"
            type="button"
            class="text-muted-foreground hover:text-foreground self-start text-xs underline underline-offset-2"
            @click="discordUserId = ''"
          >
            {{ t('users.editDialog.unlink') }}
          </button>
        </div>
        <Button type="submit" class="self-end" :disabled="busy" data-user-save-handles>
          {{ t('users.editDialog.saveLinks') }}
        </Button>
      </form>

      <Separator />

      <form class="flex flex-col gap-2" @submit.prevent="savePassword">
        <Label for="user-edit-password">
          {{
            user.methods.includes('password')
              ? t('users.editDialog.resetPassword')
              : t('users.editDialog.addPassword')
          }}
        </Label>
        <div class="flex gap-2">
          <Input
            id="user-edit-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            class="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" :disabled="busy || !password || Boolean(hint)">
            {{ t('users.editDialog.set') }}
          </Button>
        </div>
        <p :class="hint ? 'text-warning' : 'text-muted-foreground'" class="text-xs">
          {{ hint ?? t('users.editDialog.passwordNote') }}
        </p>
      </form>

      <p v-if="error" class="text-destructive text-sm" role="alert">{{ error }}</p>

      <DialogFooter class="sm:justify-between">
        <p v-if="user.admin" class="text-muted-foreground text-xs">
          {{ t('users.editDialog.adminNoDelete') }}
        </p>
        <p v-else-if="isSelf" class="text-muted-foreground text-xs">
          {{ t('users.editDialog.selfNoDelete') }}
        </p>
        <Button
          v-else-if="!confirmDelete"
          variant="outline"
          class="text-destructive"
          :disabled="busy"
          @click="confirmDelete = true"
        >
          {{ t('users.editDialog.delete') }}
        </Button>
        <Button v-else variant="destructive" :disabled="busy" data-user-delete @click="remove">
          {{ t('users.editDialog.confirmDelete') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
