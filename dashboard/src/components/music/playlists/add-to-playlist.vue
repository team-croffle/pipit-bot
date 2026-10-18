<script setup lang="ts">
  import { ListPlus, Plus } from 'lucide-vue-next';
  import { ref } from 'vue';

  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { usePlaylistSaver } from '@/composables/use-playlist-saver';
  import type { PlaylistItemSource } from '@/types';

  import PlaylistNameDialog from './playlist-name-dialog.vue';

  /**
   * "재생목록에 담기": a menu of playlists for one track (or the whole queue). Shown as an
   * icon in a row, or with a label where there is room.
   */
  const props = defineProps<{
    source: PlaylistItemSource;
    label?: string;
    disabled?: boolean;
    size?: 'xs' | 'sm';
    /** Drawn like the round playback buttons it sits beside. */
    control?: boolean;
  }>();
  const emit = defineEmits<{ saved: [] }>();

  const { playlists, loading, loadPlaylists, save, createAndSave } = usePlaylistSaver();
  const naming = ref(false);
  const saving = ref(false);

  function onOpen(open: boolean): void {
    if (open) {
      void loadPlaylists();
    }
  }

  async function pick(playlist: { id: string; name: string }): Promise<void> {
    saving.value = true;
    if (await save(playlist, props.source)) {
      emit('saved');
    }
    saving.value = false;
  }

  async function createThenSave(name: string): Promise<void> {
    saving.value = true;
    if (await createAndSave(name, props.source)) {
      naming.value = false;
      emit('saved');
    }
    saving.value = false;
  }
</script>

<template>
  <DropdownMenu @update:open="onOpen">
    <DropdownMenuTrigger as-child>
      <Button
        :variant="label || control ? 'outline' : 'ghost'"
        :size="control ? 'icon' : label ? (size ?? 'sm') : size === 'sm' ? 'icon-sm' : 'icon-xs'"
        :class="control ? 'rounded-full' : ''"
        :disabled="disabled || saving"
        :aria-label="label ?? '재생목록에 담기'"
        title="재생목록에 담기"
        data-add-to-playlist
      >
        <ListPlus />
        <template v-if="label">{{ label }}</template>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="max-w-72">
      <DropdownMenuLabel>재생목록에 담기</DropdownMenuLabel>
      <DropdownMenuItem v-if="loading && !playlists.length" disabled>불러오는 중…</DropdownMenuItem>
      <DropdownMenuItem
        v-for="playlist in playlists"
        :key="playlist.id"
        :data-add-to="playlist.id"
        @select="pick(playlist)"
      >
        <span class="truncate">{{ playlist.name }}</span>
        <span class="text-muted-foreground ml-auto pl-2 text-xs">{{ playlist.itemCount }}</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem data-add-to-new @select="naming = true">
        <Plus />
        새 재생목록…
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <PlaylistNameDialog
    v-model:open="naming"
    title="새 재생목록에 담기"
    description="공용 재생목록을 만들고 이 곡을 담습니다."
    :busy="saving"
    @submit="createThenSave"
  />
</template>
