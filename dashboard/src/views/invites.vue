<script setup lang="ts">
  import { Plus, Trash2 } from 'lucide-vue-next';
  import { onMounted, ref } from 'vue';

  import { fetchJson } from '@/api';
  import ChannelSelect from '@/components/common/channel-select.vue';
  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Label } from '@/components/ui/label';
  import { Textarea } from '@/components/ui/textarea';
  import { useGuildEvents } from '@/composables/use-guild-events';
  import type { DashboardIdentity, DiscordChannel, DiscordRole } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;

  const { settings, loading, error, saved, load, save } = useGuildEvents();
  const channels = ref<DiscordChannel[]>([]);
  const roles = ref<DiscordRole[]>([]);
  const joinMessages = ref<string[]>(['']);
  const leaveMessages = ref<string[]>(['']);

  onMounted(async () => {
    const [channelBody, roleBody] = await Promise.all([
      fetchJson<{ channels: DiscordChannel[] }>('/api/discord/channels'),
      fetchJson<{ roles: DiscordRole[] }>('/api/discord/roles'),
      load(),
    ]);
    channels.value = channelBody.channels;
    roles.value = roleBody.roles;
    // An empty list would leave the operator with no field to type into.
    joinMessages.value =
      settings.value.joinMessages.length > 0 ? [...settings.value.joinMessages] : [''];
    leaveMessages.value =
      settings.value.leaveMessages.length > 0 ? [...settings.value.leaveMessages] : [''];
  });

  function addMessage(list: 'join' | 'leave'): void {
    const target = list === 'join' ? joinMessages : leaveMessages;
    target.value = [...target.value, ''];
  }

  function removeMessage(list: 'join' | 'leave', index: number): void {
    const target = list === 'join' ? joinMessages : leaveMessages;
    const next = target.value.filter((_, item) => item !== index);
    target.value = next.length > 0 ? next : [''];
  }

  function toggleJoinRole(roleId: string, on: boolean): void {
    const current = settings.value.joinRoleIds;
    settings.value.joinRoleIds = on
      ? [...new Set([...current, roleId])]
      : current.filter((id) => id !== roleId);
  }

  async function onSave(): Promise<void> {
    await save({
      logChannelId: settings.value.logChannelId || null,
      joinMessages: joinMessages.value.map((item) => item.trim()).filter(Boolean),
      leaveMessages: leaveMessages.value.map((item) => item.trim()).filter(Boolean),
      joinRoleIds: settings.value.joinRoleIds,
    });
    joinMessages.value =
      settings.value.joinMessages.length > 0 ? [...settings.value.joinMessages] : [''];
    leaveMessages.value =
      settings.value.leaveMessages.length > 0 ? [...settings.value.leaveMessages] : [''];
  }
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader title="초대 로거" description="입장·퇴장 안내와 가입 시 자동 역할 부여" />

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
            <CardTitle class="text-base">로그 채널</CardTitle>
            <CardDescription>입장·퇴장 안내가 이 채널에 기록됩니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChannelSelect
              id="log-channel"
              v-model="settings.logChannelId"
              :channels="channels"
              placeholder="지정 안 함"
              :empty-value="null"
              :disabled="readOnly"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">입장 / 퇴장 메시지</CardTitle>
            <CardDescription>
              자리표시자: <code>{user}</code> <code>{username}</code> <code>{inviter}</code>
              <code>{invite}</code>. 여러 줄을 넣으면 그중 하나를 무작위로 고릅니다.
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-5">
            <div class="flex flex-col gap-2">
              <Label>입장 메시지</Label>
              <div v-for="(_, index) in joinMessages" :key="`join-${index}`" class="flex gap-2">
                <Textarea
                  v-model="joinMessages[index]"
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
                  @click="removeMessage('join', index)"
                >
                  <Trash2 />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                class="self-start"
                :disabled="readOnly"
                @click="addMessage('join')"
              >
                <Plus />
                입장 메시지 추가
              </Button>
            </div>

            <div class="flex flex-col gap-2">
              <Label>퇴장 메시지</Label>
              <div v-for="(_, index) in leaveMessages" :key="`leave-${index}`" class="flex gap-2">
                <Textarea
                  v-model="leaveMessages[index]"
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
                  @click="removeMessage('leave', index)"
                >
                  <Trash2 />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                class="self-start"
                :disabled="readOnly"
                @click="addMessage('leave')"
              >
                <Plus />
                퇴장 메시지 추가
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">가입 시 역할 부여</CardTitle>
            <CardDescription>새로 들어온 멤버에게 자동으로 부여할 역할입니다.</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <div
          class="bg-background/85 sticky bottom-0 -mx-1 flex justify-end rounded-t-xl border-t px-1 py-3 backdrop-blur-md"
        >
          <Button :disabled="readOnly" @click="onSave">저장</Button>
        </div>
      </div>
    </StateBlock>
  </div>
</template>
