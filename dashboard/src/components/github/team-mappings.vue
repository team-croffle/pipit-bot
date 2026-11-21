<script setup lang="ts">
  import { Trash2, TriangleAlert } from 'lucide-vue-next';
  import { ref, watch } from 'vue';
  import { useI18n } from 'vue-i18n';

  import { fetchJson } from '@/api';
  import RoleSelect from '@/components/common/role-select.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import type { DiscordRole, DiscordRoleList, GithubTeamMapping } from '@/types';

  /**
   * The rows of the "Team → role" card: a GitHub team (`org/slug`) and the guild role
   * that is mentioned when a review is requested from that team.
   *
   * The card owns the role list because nothing else on the page needs it. It is
   * pulled the first time a row exists or a picker opens — the same bargain as the
   * member list — and a failed fetch leaves the rows on plain id inputs rather than
   * taking the page down.
   */
  const props = defineProps<{ modelValue: GithubTeamMapping[]; readOnly: boolean }>();
  const emit = defineEmits<{ 'update:modelValue': [GithubTeamMapping[]] }>();
  const { t } = useI18n();

  const roles = ref<DiscordRole[]>([]);
  const rolesLoading = ref(false);
  const rolesFailed = ref(false);
  // Fetched fine, but the guild has no role to offer — the rows fall back to ids.
  const rolesEmpty = ref(false);
  const canMentionAll = ref(false);
  let rolesRequested = false;

  async function loadRoles(): Promise<void> {
    if (rolesRequested) {
      return;
    }

    rolesRequested = true;
    rolesLoading.value = true;
    rolesFailed.value = false;
    try {
      const body = await fetchJson<DiscordRoleList>('/api/discord/roles');
      roles.value = body.roles;
      rolesEmpty.value = body.roles.length === 0;
      canMentionAll.value = body.canMentionAll;
    } catch {
      rolesRequested = false;
      rolesFailed.value = true;
    } finally {
      rolesLoading.value = false;
    }
  }

  watch(
    () => props.modelValue.length,
    (count) => {
      if (count > 0) {
        void loadRoles();
      }
    },
    { immediate: true },
  );

  function update(index: number, patch: Partial<GithubTeamMapping>): void {
    emit(
      'update:modelValue',
      props.modelValue.map((row, item) => (item === index ? { ...row, ...patch } : row)),
    );
  }

  function remove(index: number): void {
    emit(
      'update:modelValue',
      props.modelValue.filter((_, item) => item !== index),
    );
  }

  /**
   * A role nobody may mention only pings from a sender with "Mention everyone". Silent
   * failure here is the whole reason the flag travels with the list, so the row
   * says so before the mapping is saved.
   */
  function cannotPing(row: GithubTeamMapping): boolean {
    if (canMentionAll.value) {
      return false;
    }

    const role = roles.value.find((item) => item.id === row.discordRoleId);
    return role !== undefined && !role.mentionable;
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="modelValue.length === 0" class="text-muted-foreground text-sm">
      {{ t('github.teams.empty') }}
    </p>
    <div
      v-for="(row, index) in modelValue"
      :key="`team-${index}`"
      class="bg-muted/40 grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
      data-team-row
    >
      <div class="flex flex-col gap-1.5">
        <Label :for="`team-name-${index}`" class="sr-only">{{ t('github.teams.team') }}</Label>
        <Input
          :id="`team-name-${index}`"
          :model-value="row.githubTeam"
          :disabled="readOnly"
          placeholder="team-croffle/reviewers"
          class="font-gothic"
          autocomplete="off"
          spellcheck="false"
          @update:model-value="update(index, { githubTeam: String($event) })"
        />
        <p class="text-muted-foreground text-xs">{{ t('github.teams.teamHint') }}</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label :for="`team-role-${index}`" class="sr-only">{{ t('github.teams.role') }}</Label>
        <RoleSelect
          :id="`team-role-${index}`"
          :model-value="row.discordRoleId"
          :roles="roles"
          :loading="rolesLoading"
          :unavailable="rolesFailed"
          :disabled="readOnly"
          @open="loadRoles"
          @update:model-value="update(index, { discordRoleId: $event })"
        />
        <p
          v-if="cannotPing(row)"
          class="text-destructive flex items-start gap-1.5 text-xs"
          role="alert"
          data-team-warning
        >
          <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {{ t('github.teams.cannotPing') }}
          </span>
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        class="justify-self-end"
        :disabled="readOnly"
        :aria-label="t('github.teams.remove')"
        @click="remove(index)"
      >
        <Trash2 />
      </Button>
    </div>
    <p v-if="rolesFailed" class="text-muted-foreground text-xs">
      {{ t('github.teams.rolesFailed') }}
    </p>
    <p v-else-if="rolesEmpty && modelValue.length > 0" class="text-muted-foreground text-xs">
      {{ t('github.teams.rolesEmpty') }}
    </p>
  </div>
</template>
