<script setup lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    Download,
    Pencil,
    Play,
    Plus,
    Shuffle,
    Trash2,
    X,
  } from 'lucide-vue-next';
  import { ref } from 'vue';
  import { useI18n } from 'vue-i18n';

  import { Badge } from '@/components/ui/badge';
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
  import { formatSeconds } from '@/lib/playlists';
  import type { PlaylistDetail } from '@/types';

  import PlaylistNameDialog from './playlist-name-dialog.vue';

  const { t } = useI18n();
  const props = defineProps<{
    playlist: PlaylistDetail;
    busy: boolean;
    canPlay: boolean;
    canImport: boolean;
  }>();
  const emit = defineEmits<{
    play: [shuffle: boolean];
    rename: [name: string];
    remove: [];
    addTyped: [query: string];
    importLink: [query: string];
    removeItem: [itemId: string];
    moveItem: [itemId: string, to: number];
  }>();

  const renaming = ref(false);
  const confirming = ref(false);
  const typed = ref('');
  const link = ref('');

  function importLink(): void {
    const query = link.value.trim();
    if (query) {
      emit('importLink', query);
      link.value = '';
    }
  }

  function addTyped(): void {
    const query = typed.value.trim();
    if (query) {
      emit('addTyped', query);
      typed.value = '';
    }
  }

  function rename(name: string): void {
    emit('rename', name);
    renaming.value = false;
  }

  function confirmRemove(): void {
    emit('remove');
    confirming.value = false;
  }
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4" data-playlist-detail>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h3 class="truncate text-lg font-semibold" data-playlist-title>{{ playlist.name }}</h3>
          <Badge variant="outline">{{
            playlist.scope === 'shared' ? t('playlists.shared') : t('playlists.personal')
          }}</Badge>
        </div>
        <p class="text-muted-foreground tnum text-sm">
          {{ t('playlists.trackCount', { count: playlist.itemCount }, playlist.itemCount) }} ·
          {{ formatSeconds(playlist.totalSec) }} ·
          {{ playlist.createdBy }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          :disabled="busy || !canPlay || playlist.itemCount === 0"
          data-playlist-play
          @click="emit('play', false)"
        >
          <Play />
          {{ t('playlists.play') }}
        </Button>
        <Button
          variant="outline"
          :disabled="busy || !canPlay || playlist.itemCount === 0"
          data-playlist-shuffle
          @click="emit('play', true)"
        >
          <Shuffle />
          {{ t('playlists.shuffle') }}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :disabled="busy"
          :aria-label="t('playlists.rename')"
          :title="t('playlists.rename')"
          data-playlist-rename
          @click="renaming = true"
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :disabled="busy"
          :aria-label="t('playlists.delete')"
          :title="t('playlists.delete')"
          data-playlist-delete
          @click="confirming = true"
        >
          <Trash2 />
        </Button>
      </div>
    </div>

    <p v-if="!canPlay" class="text-muted-foreground text-sm">
      {{ t('playlists.joinFirst') }}
    </p>

    <form class="flex gap-2" @submit.prevent="addTyped">
      <Input
        v-model="typed"
        maxlength="500"
        :placeholder="t('playlists.typedPlaceholder')"
        :aria-label="t('playlists.typedLabel')"
        class="min-w-0 flex-1"
        data-playlist-typed
      />
      <Button
        type="submit"
        variant="outline"
        :disabled="busy || !typed.trim()"
        data-playlist-typed-add
      >
        <Plus />
        {{ t('playlists.add') }}
      </Button>
    </form>

    <form v-if="canImport" class="flex gap-2" @submit.prevent="importLink">
      <Input
        v-model="link"
        maxlength="500"
        :placeholder="t('playlists.importPlaceholder')"
        :aria-label="t('playlists.importLabel')"
        class="min-w-0 flex-1"
        data-playlist-import-link
      />
      <Button type="submit" variant="outline" :disabled="busy || !link.trim()" data-playlist-import>
        <Download />
        {{ t('playlists.import') }}
      </Button>
    </form>

    <p v-if="playlist.items.length === 0" class="text-muted-foreground text-sm">
      {{ t('playlists.noItems') }}
    </p>
    <ol v-else class="flex list-none flex-col gap-1 p-0" data-playlist-items>
      <li
        v-for="(item, index) in playlist.items"
        :key="item.id"
        class="hover:bg-muted/50 flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5"
        data-playlist-item
      >
        <span class="text-muted-foreground tnum w-6 shrink-0 text-right text-xs">{{
          index + 1
        }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm" :title="item.title">{{ item.title }}</p>
          <p
            v-if="item.typed && item.request !== item.title"
            class="text-muted-foreground truncate text-xs"
          >
            {{ t('playlists.typedAs', { request: item.request }) }}
          </p>
        </div>
        <span v-if="item.durationSec" class="text-muted-foreground tnum shrink-0 text-xs">
          {{ formatSeconds(item.durationSec) }}
        </span>
        <div class="flex shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="busy || index === 0"
            :aria-label="t('music.row.up')"
            @click="emit('moveItem', item.id, index - 1)"
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="busy || index === playlist.items.length - 1"
            :aria-label="t('music.row.down')"
            @click="emit('moveItem', item.id, index + 1)"
          >
            <ArrowDown />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="busy"
            :aria-label="t('music.row.remove')"
            data-playlist-item-remove
            @click="emit('removeItem', item.id)"
          >
            <X />
          </Button>
        </div>
      </li>
    </ol>

    <PlaylistNameDialog
      v-model:open="renaming"
      :title="t('playlists.rename')"
      :initial="props.playlist.name"
      :busy="busy"
      @submit="rename"
    />
    <Dialog v-model:open="confirming">
      <DialogContent class="sm:max-w-md" data-playlist-delete-dialog>
        <DialogHeader>
          <DialogTitle>{{ t('playlists.delete') }}</DialogTitle>
          <DialogDescription>
            {{
              t(
                'playlists.deleteBody',
                { name: playlist.name, count: playlist.itemCount },
                playlist.itemCount,
              )
            }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="confirming = false">
            {{ t('playlists.cancel') }}
          </Button>
          <Button variant="destructive" data-playlist-delete-confirm @click="confirmRemove">
            {{ t('playlists.deleteConfirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
