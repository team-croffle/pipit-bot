<script setup lang="ts">
  import { computed, ref, watch } from 'vue';

  import { postJson } from '@/api';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
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
  import { passwordHint, type DashboardUser } from '@/lib/users';

  const open = defineModel<boolean>('open', { required: true });
  const emit = defineEmits<{ saved: [DashboardUser[]] }>();

  const username = ref('');
  const password = ref('');
  const admin = ref(false);
  const busy = ref(false);
  const error = ref('');

  const hint = computed(() => (password.value ? passwordHint(password.value) : null));

  watch(open, (now) => {
    if (now) {
      username.value = '';
      password.value = '';
      admin.value = false;
      error.value = '';
    }
  });

  async function save(): Promise<void> {
    busy.value = true;
    try {
      const body = await postJson<{ users: DashboardUser[] }>('/api/users', {
        username: username.value.trim(),
        password: password.value,
        admin: admin.value,
      });
      emit('saved', body.users);
      open.value = false;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '추가하지 못했습니다.';
    } finally {
      busy.value = false;
    }
  }
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md [&>*]:min-w-0" data-user-add-dialog>
      <DialogHeader>
        <DialogTitle>사용자 추가</DialogTitle>
        <DialogDescription>비밀번호로 로그인하는 계정을 만듭니다.</DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="save">
        <div class="flex flex-col gap-2">
          <Label for="user-add-name">사용자 이름</Label>
          <Input
            id="user-add-name"
            v-model="username"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            required
          />
          <p class="text-muted-foreground text-xs">
            3–30자, 영문·숫자·<code>_</code>·<code>.</code>
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <Label for="user-add-password">비밀번호</Label>
          <Input
            id="user-add-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
          />
          <p :class="hint ? 'text-warning' : 'text-muted-foreground'" class="text-xs">
            {{ hint ?? '8자 이상, 대문자·소문자·숫자·기호 중 두 종류 이상' }}
          </p>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <Checkbox v-model="admin" data-user-add-admin />
          관리자(쓰기 권한)
        </label>
        <p v-if="error" class="text-destructive text-sm" role="alert">{{ error }}</p>
        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">취소</Button>
          <Button type="submit" :disabled="busy || !username.trim() || Boolean(hint) || !password">
            {{ busy ? '추가하는 중…' : '추가' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
