<script setup lang="ts">
  import { Download, ListMusic, Plus } from 'lucide-vue-next';
  import { computed, onMounted, ref } from 'vue';
  import { I18nT, useI18n } from 'vue-i18n';
  import { RouterLink } from 'vue-router';

  import StateBlock from '@/components/common/state-block.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent } from '@/components/ui/card';
  import { usePlaylists } from '@/composables/use-playlists';
  import { formatSeconds } from '@/lib/playlists';
  import type { PlaybackState, PlaylistScope } from '@/types';

  import PlaylistDetail from './playlists/playlist-detail.vue';
  import PlaylistImportDialog from './playlists/playlist-import-dialog.vue';
  import PlaylistNameDialog from './playlists/playlist-name-dialog.vue';

  const { t } = useI18n();
  const props = defineProps<{ playback: PlaybackState | null; discordLinked: boolean }>();
  /** Playing changes the playback state; the page syncs with the bot only now and then. */
  const emit = defineEmits<{ changed: [] }>();

  const {
    playlists,
    selected,
    loading,
    busy,
    error,
    message,
    load,
    open,
    create,
    rename,
    remove,
    addItem,
    removeItem,
    moveItem,
    play,
    importLink,
  } = usePlaylists();

  const canImport = computed(
    () => !props.playback?.capabilities || props.playback.capabilities.includes('expand'),
  );

  const creating = ref(false);
  const importing = ref(false);

  async function onImport(query: string, name: string, scope: PlaylistScope): Promise<void> {
    if (await importLink(query, { name: name || undefined, scope })) {
      importing.value = false;
    }
  }

  onMounted(load);

  const groups = computed(() => [
    {
      key: 'shared',
      title: t('playlists.shared'),
      items: playlists.value.filter((p) => p.scope === 'shared'),
    },
    {
      key: 'personal',
      title: t('playlists.mine'),
      items: playlists.value.filter((p) => p.scope === 'personal'),
    },
  ]);

  async function onCreate(name: string, scope: PlaylistScope): Promise<void> {
    if (await create(name, scope)) {
      creating.value = false;
    }
  }
</script>

<template>
  <div class="flex flex-col gap-4" data-playlists>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-muted-foreground text-sm">
        {{ t('playlists.intro') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <Button
          v-if="canImport"
          variant="outline"
          size="sm"
          :disabled="busy"
          data-playlist-import-new
          @click="importing = true"
        >
          <Download />
          {{ t('playlists.importLink') }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="busy"
          data-playlist-new
          @click="creating = true"
        >
          <Plus />
          {{ t('playlists.new') }}
        </Button>
      </div>
    </div>

    <p
      v-if="props.playback?.playlist"
      class="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm"
      data-playlist-feed
    >
      {{
        t(
          'playlists.feed',
          {
            name: props.playback.playlist.name,
            count: props.playback.playlist.remaining,
          },
          props.playback.playlist.remaining,
        )
      }}<span v-if="props.playback.playlist.failed > 0">{{
        t(
          'playlists.feedSkipped',
          { count: props.playback.playlist.failed },
          props.playback.playlist.failed,
        )
      }}</span>
    </p>
    <p
      v-if="error || message"
      class="text-sm"
      :class="error ? 'text-destructive' : 'text-muted-foreground'"
      :role="error ? 'alert' : undefined"
      aria-live="polite"
      data-playlist-message
    >
      {{ error || message }}
    </p>

    <StateBlock :loading="loading">
      <Card v-if="playlists.length === 0" class="border-dashed">
        <CardContent class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div class="bg-muted text-muted-foreground rounded-xl p-3">
            <ListMusic class="size-6" />
          </div>
          <div class="min-w-0">
            <p class="font-medium">{{ t('playlists.none') }}</p>
            <p class="text-muted-foreground mt-1 text-sm">
              {{ t('playlists.noneHint') }}
            </p>
          </div>
        </CardContent>
      </Card>

      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div class="flex min-w-0 flex-col gap-3" data-playlist-list>
          <section v-for="group in groups" :key="group.key" class="flex flex-col gap-2">
            <h3 class="text-muted-foreground text-xs font-medium">{{ group.title }}</h3>
            <p
              v-if="group.key === 'personal' && !discordLinked"
              class="text-muted-foreground text-xs"
              data-playlist-link-hint
            >
              <I18nT keypath="playlists.linkHint" scope="global">
                <template #link>
                  <RouterLink to="/github" class="underline">
                    {{ t('playlists.githubPage') }}
                  </RouterLink>
                </template>
              </I18nT>
            </p>
            <p v-else-if="group.items.length === 0" class="text-muted-foreground text-xs">
              {{ t('playlists.empty') }}
            </p>
            <ul v-else class="flex list-none flex-col gap-2 p-0">
              <li v-for="playlist in group.items" :key="playlist.id">
                <button
                  type="button"
                  class="border-border hover:bg-muted/50 flex w-full min-w-0 flex-col gap-0.5 rounded-lg border px-3 py-2 text-left"
                  :class="selected?.id === playlist.id ? 'bg-muted border-primary/40' : ''"
                  :aria-current="selected?.id === playlist.id ? 'true' : undefined"
                  data-playlist-entry
                  @click="open(playlist.id)"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <span class="truncate font-medium">{{ playlist.name }}</span>
                    <Badge v-if="playlist.scope === 'personal'" variant="outline" class="shrink-0">
                      {{ t('playlists.personal') }}
                    </Badge>
                  </span>
                  <span class="text-muted-foreground tnum text-xs">
                    {{
                      t('playlists.trackCount', { count: playlist.itemCount }, playlist.itemCount)
                    }}
                    ·
                    {{ formatSeconds(playlist.totalSec) }}
                  </span>
                </button>
              </li>
            </ul>
          </section>
        </div>

        <Card>
          <CardContent>
            <PlaylistDetail
              v-if="selected"
              :playlist="selected"
              :busy="busy"
              :can-play="Boolean(props.playback?.canEnqueue)"
              @play="(shuffle) => play(selected!.id, shuffle).then(() => emit('changed'))"
              @rename="(name) => rename(selected!.id, name)"
              @remove="remove(selected!.id)"
              :can-import="canImport"
              @add-typed="(query) => addItem(selected!.id, { from: 'typed', query })"
              @import-link="(query) => importLink(query, { into: selected!.id })"
              @remove-item="(itemId) => removeItem(selected!.id, itemId)"
              @move-item="(itemId, to) => moveItem(selected!.id, itemId, to)"
            />
            <p v-else class="text-muted-foreground text-sm">{{ t('playlists.pick') }}</p>
          </CardContent>
        </Card>
      </div>
    </StateBlock>

    <PlaylistNameDialog
      v-model:open="creating"
      :title="t('playlists.new')"
      :description="discordLinked ? t('playlists.newScopes') : t('playlists.newShared')"
      :scope-choice="discordLinked"
      :busy="busy"
      @submit="onCreate"
    />
    <PlaylistImportDialog
      v-model:open="importing"
      :busy="busy"
      :scope-choice="discordLinked"
      @submit="onImport"
    />
  </div>
</template>
