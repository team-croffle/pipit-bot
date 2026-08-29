<script setup lang="ts">
  import { Plus, Trash2 } from 'lucide-vue-next';
  import { computed, onMounted, ref } from 'vue';

  import { fetchJson, putJson } from '@/api';
  import { groupChannels } from '@/channels';
  import ChannelSelect from '@/components/common/channel-select.vue';
  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
  import { Textarea } from '@/components/ui/textarea';
  import type {
    BotRuntimeConfig,
    DashboardIdentity,
    DiscordChannel,
    DiscordRole,
    GuildEventSettings,
    ReactionRoleMapping,
  } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;

  const settings = ref<GuildEventSettings>({
    logChannelId: null,
    joinMessages: [''],
    leaveMessages: [''],
    joinRoleIds: [],
    reactionRoles: [],
  });
  const botConfig = ref<BotRuntimeConfig>({ prefix: '!', musicChannelIds: [] });
  const channels = ref<DiscordChannel[]>([]);
  const channelGroups = computed(() => groupChannels(channels.value));
  const roles = ref<DiscordRole[]>([]);
  const error = ref('');
  const saved = ref('');
  const loading = ref(true);

  function emptyMapping(): ReactionRoleMapping {
    return { channelId: '', messageId: '', emoji: '', roleId: '' };
  }

  onMounted(async () => {
    try {
      const [loaded, configBody, channelBody, roleBody] = await Promise.all([
        fetchJson<GuildEventSettings>('/api/guild-events'),
        fetchJson<BotRuntimeConfig>('/api/config'),
        fetchJson<{ channels: DiscordChannel[] }>('/api/discord/channels'),
        fetchJson<{ roles: DiscordRole[] }>('/api/discord/roles'),
      ]);
      settings.value = {
        ...loaded,
        joinMessages: loaded.joinMessages.length > 0 ? loaded.joinMessages : [''],
        leaveMessages: loaded.leaveMessages.length > 0 ? loaded.leaveMessages : [''],
      };
      botConfig.value = {
        prefix: configBody.prefix || '!',
        musicChannelIds: configBody.musicChannelIds ?? [],
      };
      channels.value = channelBody.channels;
      roles.value = roleBody.roles;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '설정을 불러오지 못했습니다.';
    } finally {
      loading.value = false;
    }
  });

  function addMessage(list: 'joinMessages' | 'leaveMessages'): void {
    settings.value[list] = [...settings.value[list], ''];
  }

  function removeMessage(list: 'joinMessages' | 'leaveMessages', index: number): void {
    const next = settings.value[list].filter((_, itemIndex) => itemIndex !== index);
    settings.value[list] = next.length > 0 ? next : [''];
  }

  function addReactionRow(): void {
    settings.value.reactionRoles = [...settings.value.reactionRoles, emptyMapping()];
  }

  function removeReactionRow(index: number): void {
    settings.value.reactionRoles = settings.value.reactionRoles.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  function toggleJoinRole(roleId: string, on: boolean): void {
    const current = settings.value.joinRoleIds;
    settings.value.joinRoleIds = on
      ? [...new Set([...current, roleId])]
      : current.filter((id) => id !== roleId);
  }

  function toggleMusicChannel(channelId: string, on: boolean): void {
    const current = botConfig.value.musicChannelIds;
    botConfig.value.musicChannelIds = on
      ? [...new Set([...current, channelId])]
      : current.filter((id) => id !== channelId);
  }

  async function save(): Promise<void> {
    error.value = '';
    saved.value = '';
    try {
      const payload: GuildEventSettings = {
        logChannelId: settings.value.logChannelId || null,
        joinMessages: settings.value.joinMessages.map((item) => item.trim()).filter(Boolean),
        leaveMessages: settings.value.leaveMessages.map((item) => item.trim()).filter(Boolean),
        joinRoleIds: settings.value.joinRoleIds,
        reactionRoles: settings.value.reactionRoles.filter(
          (row) => row.channelId && row.messageId && row.emoji.trim() && row.roleId,
        ),
      };
      const [savedEvents, savedConfig] = await Promise.all([
        putJson<GuildEventSettings>('/api/guild-events', payload),
        putJson<BotRuntimeConfig>('/api/config', {
          prefix: botConfig.value.prefix,
          musicChannelIds: botConfig.value.musicChannelIds,
        }),
      ]);
      settings.value = savedEvents;
      botConfig.value = {
        prefix: savedConfig.prefix || '!',
        musicChannelIds: savedConfig.musicChannelIds ?? [],
      };
      if (settings.value.joinMessages.length === 0) {
        settings.value.joinMessages = [''];
      }
      if (settings.value.leaveMessages.length === 0) {
        settings.value.leaveMessages = [''];
      }
      saved.value = '저장했습니다.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '저장하지 못했습니다.';
    }
  }
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader title="설정" description="길드 이벤트, 역할, 명령 채널 등 봇의 기본 동작" />

    <p v-if="readOnly" class="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm">
      읽기 전용 계정입니다 — 설정을 변경할 수 없습니다.
    </p>

    <StateBlock :loading="loading">
      <div class="flex flex-col gap-5">
        <Alert v-if="error" variant="destructive">
          <AlertTitle>문제가 발생했습니다</AlertTitle>
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
        <Alert v-else-if="saved">
          <AlertDescription>{{ saved }}</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">입장 / 퇴장</CardTitle>
            <CardDescription>
              사용 가능한 자리표시자: <code>{user}</code> <code>{username}</code>
              <code>{inviter}</code> <code>{invite}</code>. 여러 줄을 넣으면 그중 하나를 무작위로
              고릅니다.
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-5">
            <div class="flex flex-col gap-1.5">
              <Label for="log-channel">로그 채널</Label>
              <ChannelSelect
                id="log-channel"
                v-model="settings.logChannelId"
                :channels="channels"
                placeholder="지정 안 함"
                :placeholder-value="null"
                :disabled="readOnly"
              />
            </div>

            <div class="flex flex-col gap-2">
              <Label>입장 메시지</Label>
              <div
                v-for="(_, index) in settings.joinMessages"
                :key="`join-${index}`"
                class="flex gap-2"
              >
                <Textarea
                  v-model="settings.joinMessages[index]"
                  :disabled="readOnly"
                  placeholder="{user} 님이 들어왔습니다 ({inviter} 초대)"
                  rows="2"
                  class="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  :disabled="readOnly"
                  aria-label="입장 메시지 삭제"
                  @click="removeMessage('joinMessages', index)"
                >
                  <Trash2 />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                class="self-start"
                :disabled="readOnly"
                @click="addMessage('joinMessages')"
              >
                <Plus />
                입장 메시지 추가
              </Button>
            </div>

            <div class="flex flex-col gap-2">
              <Label>퇴장 메시지</Label>
              <div
                v-for="(_, index) in settings.leaveMessages"
                :key="`leave-${index}`"
                class="flex gap-2"
              >
                <Textarea
                  v-model="settings.leaveMessages[index]"
                  :disabled="readOnly"
                  placeholder="{username} 님이 나갔습니다"
                  rows="2"
                  class="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  :disabled="readOnly"
                  aria-label="퇴장 메시지 삭제"
                  @click="removeMessage('leaveMessages', index)"
                >
                  <Trash2 />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                class="self-start"
                :disabled="readOnly"
                @click="addMessage('leaveMessages')"
              >
                <Plus />
                퇴장 메시지 추가
              </Button>
            </div>

            <div class="flex flex-col gap-2">
              <Label>입장 시 부여할 역할</Label>
              <p v-if="roles.length === 0" class="text-muted-foreground text-sm">
                가져온 역할이 없습니다.
              </p>
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div v-for="role in roles" :key="role.id" class="flex items-center gap-2.5">
                  <Checkbox
                    :id="`join-role-${role.id}`"
                    :model-value="settings.joinRoleIds.includes(role.id)"
                    :disabled="readOnly"
                    @update:model-value="toggleJoinRole(role.id, $event === true)"
                  />
                  <Label :for="`join-role-${role.id}`" class="truncate font-normal">
                    {{ role.name }}
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">리액션 롤</CardTitle>
            <CardDescription>
              지정한 메시지에 반응하면 역할이 부여되고, 반응을 취소하면 회수됩니다.
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" :disabled="readOnly" @click="addReactionRow">
                <Plus />
                추가
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent class="flex flex-col gap-2">
            <p v-if="settings.reactionRoles.length === 0" class="text-muted-foreground text-sm">
              설정된 리액션 롤이 없습니다.
            </p>
            <div
              v-for="(row, index) in settings.reactionRoles"
              :key="`rr-${index}`"
              class="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_auto_1fr_auto]"
            >
              <ChannelSelect
                v-model="row.channelId"
                :channels="channels"
                placeholder="채널"
                placeholder-value=""
                :disabled="readOnly"
              />
              <Input v-model="row.messageId" :disabled="readOnly" placeholder="메시지 ID" />
              <Input
                v-model="row.emoji"
                :disabled="readOnly"
                placeholder="이모지"
                class="lg:w-24"
              />
              <NativeSelect v-model="row.roleId" :disabled="readOnly" class="w-full">
                <NativeSelectOption value="">역할</NativeSelectOption>
                <NativeSelectOption v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.name }}
                </NativeSelectOption>
              </NativeSelect>
              <Button
                variant="ghost"
                size="icon"
                :disabled="readOnly"
                aria-label="리액션 롤 삭제"
                @click="removeReactionRow(index)"
              >
                <Trash2 />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">음악</CardTitle>
            <CardDescription>
              음악 명령을 특정 텍스트 채널로 제한합니다. 모두 해제하면 어느 채널에서나 허용됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div v-for="group in channelGroups" :key="group.category" class="flex flex-col gap-2">
              <span class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                {{ group.category }}
              </span>
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div
                  v-for="channel in group.channels"
                  :key="channel.id"
                  class="flex items-center gap-2.5"
                  :title="channel.canPost ? '' : '봇이 이 채널에 글을 쓸 수 없습니다.'"
                >
                  <Checkbox
                    :id="`music-${channel.id}`"
                    :model-value="botConfig.musicChannelIds.includes(channel.id)"
                    :disabled="readOnly || !channel.canPost"
                    @update:model-value="toggleMusicChannel(channel.id, $event === true)"
                  />
                  <Label
                    :for="`music-${channel.id}`"
                    class="truncate font-normal"
                    :class="channel.canPost ? '' : 'text-muted-foreground'"
                  >
                    {{ channel.name }}
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">봇 설정</CardTitle>
            <CardDescription>프리픽스는 즉시 적용됩니다.</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="prefix">명령어 프리픽스</Label>
              <Input
                id="prefix"
                v-model="botConfig.prefix"
                :disabled="readOnly"
                placeholder="!"
                class="w-24 text-center font-mono"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="rss" class="text-muted-foreground">블로그 RSS 피드</Label>
              <Input id="rss" disabled placeholder="v1.0.1에서 지원 예정" />
            </div>
          </CardContent>
        </Card>

        <!-- Long forms scroll well past the button, so it rides along at the bottom. -->
        <div
          class="bg-background/85 sticky bottom-0 -mx-1 flex justify-end rounded-t-xl border-t px-1 py-3 backdrop-blur-md"
        >
          <Button :disabled="readOnly" @click="save">저장</Button>
        </div>
      </div>
    </StateBlock>
  </div>
</template>
