<script setup lang="ts">
  import { onMounted } from 'vue';

  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import ChannelRestriction from '@/components/music/channel-restriction.vue';
  import JobsTable from '@/components/music/jobs-table.vue';
  import NowPlaying from '@/components/music/now-playing.vue';
  import PlaybackOptions from '@/components/music/playback-options.vue';
  import PlaylistsPanel from '@/components/music/playlists-panel.vue';
  import QueueCard from '@/components/music/queue-card.vue';
  import VoiceCard from '@/components/music/voice-card.vue';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { usePlayback } from '@/composables/use-playback';
  import type { DashboardIdentity } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();

  const { playback, loading, error, message, busy, run, setRepeat, enqueue, start, refresh } =
    usePlayback();

  onMounted(start);
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader title="음악" description="재생 제어, 재생목록, 재생 옵션" />

    <Tabs default-value="control" class="gap-5">
      <TabsList>
        <TabsTrigger value="control" data-tab="control">재생 제어</TabsTrigger>
        <TabsTrigger value="playlists" data-tab="playlists">재생목록</TabsTrigger>
        <TabsTrigger value="options" data-tab="options">재생 옵션</TabsTrigger>
      </TabsList>

      <TabsContent value="control" class="flex flex-col gap-4">
        <StateBlock :loading="loading">
          <div class="flex flex-col gap-4">
            <NowPlaying
              :playback="playback"
              :busy="busy"
              :error="error"
              :message="message"
              @action="run"
              @repeat="setRepeat"
              @enqueue="enqueue"
              @searched="refresh"
            />
            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <QueueCard :playback="playback" :busy="busy" @action="run" @repeat="setRepeat" />
              <VoiceCard :playback="playback" :busy="busy" @action="run" />
            </div>
          </div>
        </StateBlock>
        <JobsTable @changed="refresh" />
      </TabsContent>

      <TabsContent value="playlists">
        <PlaylistsPanel
          :playback="playback"
          :discord-linked="Boolean(me.discordUserId)"
          @changed="refresh"
        />
      </TabsContent>

      <TabsContent value="options" class="flex flex-col gap-4">
        <PlaybackOptions :playback="playback" :busy="busy" :error="error" @action="run" />
        <ChannelRestriction :read-only="!me.canWriteSettings" />
      </TabsContent>
    </Tabs>
  </div>
</template>
