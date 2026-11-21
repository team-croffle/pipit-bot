<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useI18n } from 'vue-i18n';

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
  const { t } = useI18n();

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
      error.value = cause instanceof Error ? cause.message : t('users.addDialog.failed');
    } finally {
      busy.value = false;
    }
  }
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md [&>*]:min-w-0" data-user-add-dialog>
      <DialogHeader>
        <DialogTitle>{{ t('users.add') }}</DialogTitle>
        <DialogDescription>{{ t('users.addDialog.description') }}</DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="save">
        <div class="flex flex-col gap-2">
          <Label for="user-add-name">{{ t('users.addDialog.username') }}</Label>
          <Input
            id="user-add-name"
            v-model="username"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            required
          />
          <p class="text-muted-foreground text-xs">
            {{ t('users.addDialog.usernameHint') }}<code>_</code>{{ t('users.addDialog.usernameOr')
            }}<code>.</code>
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <Label for="user-add-password">{{ t('users.addDialog.password') }}</Label>
          <Input
            id="user-add-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
          />
          <p :class="hint ? 'text-warning' : 'text-muted-foreground'" class="text-xs">
            {{ hint ?? t('users.addDialog.passwordHint') }}
          </p>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <Checkbox v-model="admin" data-user-add-admin />
          {{ t('users.addDialog.admin') }}
        </label>
        <p v-if="error" class="text-destructive text-sm" role="alert">{{ error }}</p>
        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">{{
            t('users.addDialog.cancel')
          }}</Button>
          <Button type="submit" :disabled="busy || !username.trim() || Boolean(hint) || !password">
            {{ busy ? t('users.addDialog.adding') : t('users.addDialog.submit') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
