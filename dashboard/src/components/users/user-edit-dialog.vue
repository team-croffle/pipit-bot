<script setup lang="ts">
  import { computed, ref, watch } from 'vue';

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
      error.value = cause instanceof Error ? cause.message : '저장하지 못했습니다.';
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
          GitHub 로그인과 디스코드 계정은 멘션·개인 재생목록·내 결산이 이 사람을 찾는 데 씁니다.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="saveHandles">
        <div class="flex flex-col gap-2">
          <Label for="user-edit-github">GitHub 로그인</Label>
          <Input
            id="user-edit-github"
            v-model="githubLogin"
            placeholder="없음"
            autocapitalize="none"
            spellcheck="false"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="user-edit-discord">디스코드 계정</Label>
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
            연결 해제
          </button>
        </div>
        <Button type="submit" class="self-end" :disabled="busy" data-user-save-handles>
          연결 저장
        </Button>
      </form>

      <Separator />

      <form class="flex flex-col gap-2" @submit.prevent="savePassword">
        <Label for="user-edit-password">
          {{ user.methods.includes('password') ? '비밀번호 재설정' : '비밀번호 로그인 추가' }}
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
            설정
          </Button>
        </div>
        <p :class="hint ? 'text-warning' : 'text-muted-foreground'" class="text-xs">
          {{ hint ?? '설정하면 이 사람의 로그인 세션이 모두 끊깁니다.' }}
        </p>
      </form>

      <p v-if="error" class="text-destructive text-sm" role="alert">{{ error }}</p>

      <DialogFooter class="sm:justify-between">
        <p v-if="user.admin" class="text-muted-foreground text-xs">
          관리자는 삭제할 수 없습니다 — 먼저 관리자 권한을 빼세요.
        </p>
        <p v-else-if="isSelf" class="text-muted-foreground text-xs">
          자기 자신은 삭제할 수 없습니다.
        </p>
        <Button
          v-else-if="!confirmDelete"
          variant="outline"
          class="text-destructive"
          :disabled="busy"
          @click="confirmDelete = true"
        >
          사용자 삭제
        </Button>
        <Button v-else variant="destructive" :disabled="busy" data-user-delete @click="remove">
          정말 삭제
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
