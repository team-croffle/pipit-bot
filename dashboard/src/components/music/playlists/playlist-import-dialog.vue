<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { useI18n } from 'vue-i18n';

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
  const { t } = useI18n();
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
        <DialogTitle>{{ t('playlists.importLink') }}</DialogTitle>
        <DialogDescription>
          {{ t('playlists.importDescription') }}
        </DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-3" @submit.prevent="submit">
        <Input
          v-model="link"
          maxlength="500"
          :placeholder="t('playlists.link')"
          :aria-label="t('playlists.importLabel')"
          data-playlist-import-new-link
        />
        <Input
          v-model="name"
          maxlength="60"
          :placeholder="t('playlists.importName')"
          :aria-label="t('playlists.name')"
          data-playlist-import-new-name
        />
        <div
          v-if="scopeChoice"
          class="flex gap-2"
          role="radiogroup"
          :aria-label="t('playlists.scope')"
        >
          <Button
            type="button"
            size="sm"
            :variant="scope === 'shared' ? 'default' : 'outline'"
            role="radio"
            :aria-checked="scope === 'shared'"
            @click="scope = 'shared'"
          >
            {{ t('playlists.shared') }}
          </Button>
          <Button
            type="button"
            size="sm"
            :variant="scope === 'personal' ? 'default' : 'outline'"
            role="radio"
            :aria-checked="scope === 'personal'"
            @click="scope = 'personal'"
          >
            {{ t('playlists.personal') }}
          </Button>
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="busy || !link.trim()" data-playlist-import-new-submit>
            {{ t('playlists.import') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
