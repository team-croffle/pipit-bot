<script setup lang="ts">
  import { ExternalLink, Plus, Send, Trash2 } from 'lucide-vue-next';
  import { computed, onMounted, ref } from 'vue';

  import { fetchJson } from '@/api';
  import ChannelSelect from '@/components/common/channel-select.vue';
  import EmojiPicker from '@/components/common/emoji-picker.vue';
  import EmojiText from '@/components/common/emoji-text.vue';
  import OptionSelect from '@/components/common/option-select.vue';
  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import PanelEditor from '@/components/reaction-roles/panel-editor.vue';
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
  import { Switch } from '@/components/ui/switch';
  import { emptyPanel, useReactionRoles } from '@/composables/use-reaction-roles';
  import type { DashboardIdentity, DiscordChannel, DiscordRole, ReactionRolePanel } from '@/types';

  const { me } = defineProps<{ me: DashboardIdentity }>();
  const readOnly = !me.canWriteSettings;

  const { panels, guildId, loading, error, saved, busy, load, save, publish } = useReactionRoles();
  const channels = ref<DiscordChannel[]>([]);
  const roles = ref<DiscordRole[]>([]);
  const editing = ref<string | null>(null);

  onMounted(async () => {
    const [channelBody, roleBody] = await Promise.all([
      fetchJson<{ channels: DiscordChannel[] }>('/api/discord/channels'),
      fetchJson<{ roles: DiscordRole[] }>('/api/discord/roles'),
      load(),
    ]);
    channels.value = channelBody.channels;
    roles.value = roleBody.roles;
  });

  const roleNames = computed(
    () => new Map(roles.value.map((role) => [role.id, role.name] as const)),
  );

  function addPanel(): void {
    const panel = emptyPanel();
    panels.value = [...panels.value, panel];
    editing.value = panel.id;
  }

  function removePanel(id: string): void {
    panels.value = panels.value.filter((panel) => panel.id !== id);
    void save();
  }

  function addOption(panel: ReactionRolePanel): void {
    panel.options = [...panel.options, { emoji: '', roleId: '' }];
  }

  function removeOption(panel: ReactionRolePanel, index: number): void {
    panel.options = panel.options.filter((_, item) => item !== index);
  }

  function canPublish(panel: ReactionRolePanel): boolean {
    return (
      !readOnly &&
      !busy.value &&
      Boolean(panel.channelId) &&
      panel.options.length > 0 &&
      panel.options.every((option) => option.emoji.trim() && option.roleId)
    );
  }

  function messageUrl(panel: ReactionRolePanel): string {
    return `https://discord.com/channels/${guildId.value}/${panel.channelId}/${panel.messageId}`;
  }
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader title="리액션 롤" description="봇이 올린 메시지에 반응하면 역할이 부여됩니다">
      <template #actions>
        <Button :disabled="readOnly || busy" @click="addPanel">
          <Plus />
          패널 추가
        </Button>
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

        <p v-if="panels.length === 0" class="text-muted-foreground text-sm">
          패널이 없습니다. 패널을 추가하면 봇이 그 메시지를 직접 올리고, 반응에 따라 역할을
          부여합니다.
        </p>

        <Card v-for="panel in panels" :key="panel.id">
          <CardHeader>
            <CardTitle class="text-base">
              {{ panel.name || '이름 없는 패널' }}
            </CardTitle>
            <CardDescription>
              <template v-if="panel.messageId">
                발행됨 — 고치고 다시 발행하면 같은 메시지가 수정됩니다.
              </template>
              <template v-else>아직 발행하지 않았습니다.</template>
            </CardDescription>
            <CardAction class="flex items-center gap-2">
              <Badge v-if="panel.messageId" variant="outline">발행됨</Badge>
              <Badge v-else variant="secondary">미발행</Badge>
              <Button
                v-if="panel.messageId && guildId"
                variant="ghost"
                size="icon"
                as="a"
                :href="messageUrl(panel)"
                target="_blank"
                rel="noreferrer"
                aria-label="디스코드에서 메시지 보기"
              >
                <ExternalLink />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                :disabled="readOnly || busy"
                aria-label="패널 삭제"
                @click="removePanel(panel.id)"
              >
                <Trash2 />
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent class="flex flex-col gap-4">
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <Label :for="`rr-name-${panel.id}`" class="text-xs">패널 이름</Label>
                <Input
                  :id="`rr-name-${panel.id}`"
                  v-model="panel.name"
                  :disabled="readOnly"
                  placeholder="관리용 이름 — 디스코드에는 보이지 않습니다"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label :for="`rr-channel-${panel.id}`" class="text-xs">채널</Label>
                <ChannelSelect
                  :id="`rr-channel-${panel.id}`"
                  v-model="panel.channelId"
                  :channels="channels"
                  placeholder="채널 선택"
                  :empty-value="''"
                  :disabled="readOnly"
                />
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between gap-3">
                <Label class="text-xs">메시지</Label>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="readOnly"
                  @click="editing = panel.id"
                >
                  메시지 편집
                </Button>
              </div>
              <p class="text-muted-foreground text-sm">
                <EmojiText
                  :text="panel.embed.title || panel.embed.description || panel.embed.content"
                />
                <template
                  v-if="!panel.embed.title && !panel.embed.description && !panel.embed.content"
                >
                  아직 비어 있습니다.
                </template>
              </p>
            </div>

            <div class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <Label :for="`rr-single-${panel.id}`" class="flex-col items-start gap-1">
                <span class="text-sm">반응 수 1로 유지</span>
                <span class="text-muted-foreground text-xs font-normal">
                  누른 사람의 반응을 바로 떼어내고, 역할은 누를 때마다 부여·해제를 오갑니다. 봇에게
                  "메시지 관리" 권한이 필요합니다.
                </span>
              </Label>
              <Switch
                :id="`rr-single-${panel.id}`"
                v-model="panel.singleReaction"
                :disabled="readOnly"
              />
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-3">
                <Label class="text-xs">이모지 → 역할</Label>
                <Button variant="outline" size="sm" :disabled="readOnly" @click="addOption(panel)">
                  <Plus />
                  추가
                </Button>
              </div>
              <p v-if="panel.options.length === 0" class="text-muted-foreground text-sm">
                역할이 없습니다. 하나 이상 있어야 발행할 수 있습니다.
              </p>
              <div
                v-for="(option, index) in panel.options"
                :key="`${panel.id}-option-${index}`"
                class="bg-muted/40 grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
              >
                <div class="flex items-center gap-2">
                  <span class="w-8 text-center text-lg">
                    <EmojiText v-if="option.emoji" :text="option.emoji" />
                  </span>
                  <EmojiPicker :disabled="readOnly" @pick="option.emoji = $event" />
                </div>
                <OptionSelect
                  v-model="option.roleId"
                  :options="roles"
                  placeholder="역할 선택"
                  :disabled="readOnly"
                  :aria-label="`${index + 1}번째 역할`"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  :disabled="readOnly"
                  :aria-label="`${index + 1}번째 역할 삭제`"
                  @click="removeOption(panel, index)"
                >
                  <Trash2 />
                </Button>
              </div>
              <p v-if="panel.options.length > 0" class="text-muted-foreground text-xs">
                {{
                  panel.options
                    .map((option) => roleNames.get(option.roleId))
                    .filter(Boolean)
                    .join(', ')
                }}
              </p>
            </div>

            <div class="flex justify-end gap-2">
              <Button variant="outline" :disabled="readOnly || busy" @click="save()">저장</Button>
              <Button :disabled="!canPublish(panel)" @click="publish(panel.id)">
                <Send />
                {{ panel.messageId ? '다시 발행' : '발행' }}
              </Button>
            </div>
          </CardContent>

          <PanelEditor
            :open="editing === panel.id"
            :panel="panel"
            :read-only="readOnly"
            @update:open="editing = $event ? panel.id : null"
            @save="
              (embed) => {
                panel.embed = embed;
                editing = null;
              }
            "
          />
        </Card>
      </div>
    </StateBlock>
  </div>
</template>
