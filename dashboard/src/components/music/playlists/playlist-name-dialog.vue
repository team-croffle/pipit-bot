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

  /** Asks for a playlist name — for a new playlist, or a new name for one. */
  const props = defineProps<{
    title: string;
    description?: string;
    initial?: string;
    busy?: boolean;
  }>();
  const open = defineModel<boolean>('open', { required: true });
  const emit = defineEmits<{ submit: [name: string] }>();

  const name = ref('');
  watch(open, (isOpen) => {
    if (isOpen) {
      name.value = props.initial ?? '';
    }
  });

  function submit(): void {
    const trimmed = name.value.trim();
    if (trimmed) {
      emit('submit', trimmed);
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
        <DialogFooter>
          <Button type="submit" :disabled="busy || !name.trim()" data-playlist-name-submit>
            저장
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
