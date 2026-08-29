<script setup lang="ts">
  import { Plus, Trash2 } from 'lucide-vue-next';
  import { onMounted, ref } from 'vue';

  import { fetchJson } from '@/api';
  import ChannelSelect from '@/components/common/channel-select.vue';
  import OptionSelect from '@/components/common/option-select.vue';
  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { useGuildEvents } from '@/composables/use-guild-events';
  import type {
    DashboardIdentity,
    DiscordChannel,
    DiscordRole,
    ReactionRoleMapping,
  } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;

  const { settings, loading, error, saved, load, save } = useGuildEvents();
  const channels = ref<DiscordChannel[]>([]);
  const roles = ref<DiscordRole[]>([]);

  onMounted(async () => {
    const [channelBody, roleBody] = await Promise.all([
      fetchJson<{ channels: DiscordChannel[] }>('/api/discord/channels'),
      fetchJson<{ roles: DiscordRole[] }>('/api/discord/roles'),
      load(),
    ]);
    channels.value = channelBody.channels;
    roles.value = roleBody.roles;
  });

  function emptyMapping(): ReactionRoleMapping {
    return { channelId: '', messageId: '', emoji: '', roleId: '' };
  }

  function addRow(): void {
    settings.value.reactionRoles = [...settings.value.reactionRoles, emptyMapping()];
  }

  function removeRow(index: number): void {
    settings.value.reactionRoles = settings.value.reactionRoles.filter((_, item) => item !== index);
  }

  async function onSave(): Promise<void> {
    // A half-filled row cannot be acted on, so it is dropped rather than saved.
    await save({
      reactionRoles: settings.value.reactionRoles.filter(
        (row) => row.channelId && row.messageId && row.emoji.trim() && row.roleId,
      ),
    });
  }
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader title="리액션 롤" description="메시지에 반응하면 역할을 부여합니다">
      <template #actions>
        <Badge variant="outline">고도화 예정 · v0.6.7</Badge>
      </template>
    </PageHeader>

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
            <CardTitle class="text-base">이모지 → 역할 매핑</CardTitle>
            <CardDescription>
              지정한 메시지에 반응하면 역할이 부여되고, 반응을 취소하면 회수됩니다. 메시지 ID는
              디스코드에서 메시지 우클릭 → ID 복사로 얻습니다.
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" :disabled="readOnly" @click="addRow">
                <Plus />
                추가
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent class="flex flex-col gap-3">
            <p v-if="settings.reactionRoles.length === 0" class="text-muted-foreground text-sm">
              설정된 리액션 롤이 없습니다.
            </p>
            <div
              v-for="(row, index) in settings.reactionRoles"
              :key="`rr-${index}`"
              class="bg-muted/40 grid gap-3 rounded-lg border p-3 lg:grid-cols-[1.2fr_1fr_auto_1fr_auto] lg:items-end"
            >
              <div class="flex flex-col gap-1.5">
                <Label :for="`rr-channel-${index}`" class="text-xs">채널</Label>
                <ChannelSelect
                  :id="`rr-channel-${index}`"
                  v-model="row.channelId"
                  :channels="channels"
                  placeholder="채널 선택"
                  :empty-value="''"
                  :disabled="readOnly"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label :for="`rr-message-${index}`" class="text-xs">메시지 ID</Label>
                <Input
                  :id="`rr-message-${index}`"
                  v-model="row.messageId"
                  :disabled="readOnly"
                  placeholder="1234567890"
                  class="font-gothic"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label :for="`rr-emoji-${index}`" class="text-xs">이모지</Label>
                <Input
                  :id="`rr-emoji-${index}`"
                  v-model="row.emoji"
                  :disabled="readOnly"
                  placeholder="🟢"
                  class="lg:w-20"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label :for="`rr-role-${index}`" class="text-xs">역할</Label>
                <OptionSelect
                  :id="`rr-role-${index}`"
                  v-model="row.roleId"
                  :options="roles"
                  placeholder="역할 선택"
                  :disabled="readOnly"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                :disabled="readOnly"
                aria-label="리액션 롤 삭제"
                @click="removeRow(index)"
              >
                <Trash2 />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div
          class="bg-background sticky bottom-0 -mx-1 flex justify-end rounded-t-xl border-t px-1 py-3 backdrop-blur-md"
        >
          <Button :disabled="readOnly" @click="onSave">저장</Button>
        </div>
      </div>
    </StateBlock>
  </div>
</template>
