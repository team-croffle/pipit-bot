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

  /** A new playlist from a link the music worker can expand into several tracks. */
  defineProps<{ busy?: boolean; scopeChoice?: boolean }>();
  const open = defineModel<boolean>('open', { required: true });
  const emit = defineEmits<{ submit: [query: string, name: string, scope: PlaylistScope] }>();

  const link = ref('');
  const name = ref('');
  const scope = ref<PlaylistScope>('shared');
  watch(open, (isOpen) => {
    if (isOpen) {
      link.value = '';
      name.value = '';
      scope.value = 'shared';
    }
  });

  function submit(): void {
    if (link.value.trim()) {
      emit('submit', link.value.trim(), name.value.trim(), scope.value);
    }
  }
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md [&>*]:min-w-0" data-playlist-import-dialog>
      <DialogHeader>
        <DialogTitle>링크에서 가져오기</DialogTitle>
        <DialogDescription>
          music worker가 여러 곡으로 풀 수 있는 링크를 붙여 넣으면 새 재생목록으로 담습니다.
        </DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-3" @submit.prevent="submit">
        <Input
          v-model="link"
          maxlength="500"
          placeholder="링크"
          aria-label="가져올 링크"
          data-playlist-import-new-link
        />
        <Input
          v-model="name"
          maxlength="60"
          placeholder="이름(비우면 가져온 이름)"
          aria-label="재생목록 이름"
          data-playlist-import-new-name
        />
        <div v-if="scopeChoice" class="flex gap-2" role="radiogroup" aria-label="종류">
          <Button
            type="button"
            size="sm"
            :variant="scope === 'shared' ? 'default' : 'outline'"
            role="radio"
            :aria-checked="scope === 'shared'"
            @click="scope = 'shared'"
          >
            공용
          </Button>
          <Button
            type="button"
            size="sm"
            :variant="scope === 'personal' ? 'default' : 'outline'"
            role="radio"
            :aria-checked="scope === 'personal'"
            @click="scope = 'personal'"
          >
            개인
          </Button>
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="busy || !link.trim()" data-playlist-import-new-submit>
            가져오기
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
