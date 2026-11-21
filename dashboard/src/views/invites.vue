<script setup lang="ts">
  import { Plus, Trash2 } from 'lucide-vue-next';
  import { onMounted, ref } from 'vue';
  import { useI18n } from 'vue-i18n';

  import { fetchJson } from '@/api';
  import ChannelSelect from '@/components/common/channel-select.vue';
  import FeatureLanguageSelect from '@/components/common/feature-language-select.vue';
  import PageHeader from '@/components/common/page-header.vue';
  import StateBlock from '@/components/common/state-block.vue';
  import InviteStatsCard from '@/components/invites/invite-stats-card.vue';
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
  const { t } = useI18n();

  const { settings, loading, error, saved, loadError, load, save } = useGuildEvents();
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
      recordChannelId: settings.value.recordChannelId || null,
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
    <PageHeader :title="t('invites.title')" :description="t('invites.description')">
      <template #actions>
        <FeatureLanguageSelect feature="memberEvents" :read-only="readOnly" />
      </template>
    </PageHeader>

    <p v-if="readOnly" class="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm">
      {{ t('invites.readOnly') }}
    </p>

    <StateBlock :loading="loading">
      <div class="flex flex-col gap-5">
        <Alert v-if="loadError" variant="destructive">
          <AlertTitle>{{ t('invites.loadErrorTitle') }}</AlertTitle>
          <AlertDescription>
            {{ t('invites.loadErrorBody', { error: loadError }) }}
          </AlertDescription>
        </Alert>
        <Alert v-if="error" variant="destructive">
          <AlertTitle>{{ t('invites.errorTitle') }}</AlertTitle>
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
        <Alert v-else-if="saved">
          <AlertDescription>{{ saved }}</AlertDescription>
        </Alert>

        <InviteStatsCard />

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ t('invites.channels.title') }}</CardTitle>
            <CardDescription>
              {{ t('invites.channels.description') }}
            </CardDescription>
          </CardHeader>
          <CardContent class="grid gap-4 sm:grid-cols-2">
            <div class="flex min-w-0 flex-col gap-2">
              <Label for="log-channel">{{ t('invites.channels.log') }}</Label>
              <ChannelSelect
                id="log-channel"
                v-model="settings.logChannelId"
                :channels="channels"
                :placeholder="t('invites.channels.none')"
                :empty-value="null"
                :disabled="readOnly"
              />
            </div>
            <div class="flex min-w-0 flex-col gap-2" data-record-channel>
              <Label for="record-channel">{{ t('invites.channels.record') }}</Label>
              <ChannelSelect
                id="record-channel"
                v-model="settings.recordChannelId"
                :channels="channels"
                :placeholder="t('invites.channels.none')"
                :empty-value="null"
                :disabled="readOnly"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ t('invites.messages.title') }}</CardTitle>
            <CardDescription>
              {{ t('invites.messages.placeholders') }} <code>{user}</code> <code>{username}</code>
              <code>{inviter}</code> <code>{invite}</code>{{ t('invites.messages.random') }}
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-5">
            <div class="flex flex-col gap-2">
              <Label>{{ t('invites.messages.join') }}</Label>
              <div v-for="(_, index) in joinMessages" :key="`join-${index}`" class="flex gap-2">
                <Textarea
                  v-model="joinMessages[index]"
                  :disabled="readOnly"
                  :placeholder="
                    t('invites.messages.joinPlaceholder', { user: '{user}', inviter: '{inviter}' })
                  "
                  rows="2"
                  class="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  :disabled="readOnly"
                  :aria-label="t('invites.messages.joinDelete')"
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
                {{ t('invites.messages.joinAdd') }}
              </Button>
            </div>

            <div class="flex flex-col gap-2">
              <Label>{{ t('invites.messages.leave') }}</Label>
              <div v-for="(_, index) in leaveMessages" :key="`leave-${index}`" class="flex gap-2">
                <Textarea
                  v-model="leaveMessages[index]"
                  :disabled="readOnly"
                  :placeholder="t('invites.messages.leavePlaceholder', { username: '{username}' })"
                  rows="2"
                  class="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  :disabled="readOnly"
                  :aria-label="t('invites.messages.leaveDelete')"
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
                {{ t('invites.messages.leaveAdd') }}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ t('invites.joinRoles.title') }}</CardTitle>
            <CardDescription>{{ t('invites.joinRoles.description') }}</CardDescription>
          </CardHeader>
          <CardContent>
            <p v-if="roles.length === 0" class="text-muted-foreground text-sm">
              {{ t('invites.joinRoles.none') }}
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
          class="bg-background sticky bottom-0 -mx-1 flex justify-end rounded-t-xl border-t px-1 py-3 backdrop-blur-md"
        >
          <Button :disabled="readOnly" @click="onSave">{{ t('invites.save') }}</Button>
        </div>
      </div>
    </StateBlock>
  </div>
</template>
