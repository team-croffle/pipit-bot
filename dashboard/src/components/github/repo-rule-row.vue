<script setup lang="ts">
  import { Trash2 } from 'lucide-vue-next';

  import ChannelSelect from '@/components/common/channel-select.vue';
  import RepoSelect from '@/components/common/repo-select.vue';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Label } from '@/components/ui/label';
  import { Switch } from '@/components/ui/switch';
  import { eventLabels } from '@/lib/github-templates';
  import type { DiscordChannel, GithubEventToggles, GithubRepoRule } from '@/types';

  /**
   * The expanded editor of one "저장소별 설정" row: the repository, the channel it
   * posts to, and an optional per-repository event set.
   *
   * The row never mutates the rule it was given — every change goes out as a fresh
   * object through `update:modelValue`, so the page keeps one place that decides
   * what the list looks like and the save payload stays what it was.
   */
  const props = defineProps<{
    modelValue: GithubRepoRule;
    channels: DiscordChannel[];
    /** Repositories the GitHub App is installed on; offered by the picker. */
    repositories: string[];
    repositoriesLoading: boolean;
    /** The page-wide event set — shown greyed out while the row inherits it. */
    defaultEvents: GithubEventToggles;
    readOnly: boolean;
    /** Prefix for the `for`/`id` pairs, unique per row on the page. */
    idPrefix: string;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [GithubRepoRule];
    remove: [];
    /** The repository picker opened — the page fetches the list on first use. */
    'open-repositories': [];
  }>();

  function update(patch: Partial<GithubRepoRule>): void {
    emit('update:modelValue', { ...props.modelValue, ...patch });
  }

  // WHY: `events: null` means the repository inherits the defaults. Turning the
  // override on seeds it from the current defaults so nothing silently changes.
  function toggleOverride(on: boolean): void {
    update({ events: on ? { ...props.defaultEvents } : null });
  }

  function setEvent(key: keyof GithubEventToggles, on: boolean): void {
    if (!props.modelValue.events) {
      return;
    }

    update({ events: { ...props.modelValue.events, [key]: on } });
  }
</script>

<template>
  <div class="flex flex-col gap-4" data-repo-rule>
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="flex flex-col gap-1.5">
        <Label :for="`${idPrefix}-name`">저장소</Label>
        <RepoSelect
          :id="`${idPrefix}-name`"
          :model-value="modelValue.repo"
          :options="repositories"
          :loading="repositoriesLoading"
          :disabled="readOnly"
          @open="emit('open-repositories')"
          @update:model-value="update({ repo: $event })"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label :for="`${idPrefix}-channel`">채널</Label>
        <ChannelSelect
          :id="`${idPrefix}-channel`"
          :model-value="modelValue.channelId"
          :channels="channels"
          placeholder="기본 채널 사용"
          :empty-value="null"
          :disabled="readOnly"
          @update:model-value="update({ channelId: $event })"
        />
      </div>
    </div>

    <div class="flex items-center justify-between gap-4 border-t pt-4">
      <Label :for="`${idPrefix}-override`" class="flex-col items-start gap-1">
        <span>이 저장소에서 이벤트 재정의</span>
        <span class="text-muted-foreground text-xs font-normal">
          끄면 기본 알림 이벤트를 그대로 따릅니다
        </span>
      </Label>
      <Switch
        :id="`${idPrefix}-override`"
        :model-value="modelValue.events !== null"
        :disabled="readOnly"
        @update:model-value="toggleOverride($event === true)"
      />
    </div>

    <div
      class="grid gap-3 sm:grid-cols-2"
      :class="modelValue.events ? '' : 'pointer-events-none opacity-40'"
    >
      <div v-for="event in eventLabels" :key="event.key" class="flex items-center gap-2.5">
        <Checkbox
          :id="`${idPrefix}-${event.key}`"
          :model-value="modelValue.events ? modelValue.events[event.key] : defaultEvents[event.key]"
          :disabled="readOnly || !modelValue.events"
          @update:model-value="setEvent(event.key, $event === true)"
        />
        <Label :for="`${idPrefix}-${event.key}`" class="font-normal">
          {{ event.label }}
        </Label>
      </div>
    </div>

    <div class="flex justify-end border-t pt-4">
      <Button
        variant="ghost"
        size="sm"
        class="text-destructive hover:text-destructive"
        :disabled="readOnly"
        @click="emit('remove')"
      >
        <Trash2 />
        저장소 삭제
      </Button>
    </div>
  </div>
</template>
