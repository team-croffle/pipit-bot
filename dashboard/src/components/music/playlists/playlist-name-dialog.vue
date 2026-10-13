<script setup lang="ts">
  import { ref, watch } from 'vue';

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
  import type { PlaylistScope } from '@/types';

  /** Asks for a playlist name — for a new playlist, or a new name for one. */
  const props = defineProps<{
    title: string;
    description?: string;
    initial?: string;
    busy?: boolean;
    /** Offer shared or personal (a new playlist, for someone with a linked Discord account). */
    scopeChoice?: boolean;
  }>();
  const open = defineModel<boolean>('open', { required: true });
  const emit = defineEmits<{ submit: [name: string, scope: PlaylistScope] }>();

  const name = ref('');
  const scope = ref<PlaylistScope>('shared');
  watch(open, (isOpen) => {
    if (isOpen) {
      name.value = props.initial ?? '';
      scope.value = 'shared';
    }
  });

  function submit(): void {
    const trimmed = name.value.trim();
    if (trimmed) {
      emit('submit', trimmed, scope.value);
    }
  }
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md [&>*]:min-w-0" data-playlist-name-dialog>
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <Input
          v-model="name"
          maxlength="60"
          placeholder="재생목록 이름"
          aria-label="재생목록 이름"
          data-playlist-name
        />
        <div v-if="scopeChoice" class="flex gap-2" role="radiogroup" aria-label="종류">
          <Button
            type="button"
            size="sm"
            :variant="scope === 'shared' ? 'default' : 'outline'"
            role="radio"
            :aria-checked="scope === 'shared'"
            data-playlist-scope="shared"
            @click="scope = 'shared'"
          >
            공용 — 누구나 고침
          </Button>
          <Button
            type="button"
            size="sm"
            :variant="scope === 'personal' ? 'default' : 'outline'"
            role="radio"
            :aria-checked="scope === 'personal'"
            data-playlist-scope="personal"
            @click="scope = 'personal'"
          >
            개인 — 나만
          </Button>
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="busy || !name.trim()" data-playlist-name-submit>
            저장
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
