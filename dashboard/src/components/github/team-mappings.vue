<script setup lang="ts">
  import { Trash2, TriangleAlert } from 'lucide-vue-next';
  import { ref, watch } from 'vue';

  import { fetchJson } from '@/api';
  import RoleSelect from '@/components/common/role-select.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import type { DiscordRole, DiscordRoleList, GithubTeamMapping } from '@/types';

  /**
   * The rows of the "팀 → 역할" card: a GitHub team (`org/slug`) and the guild role
   * that is mentioned when a review is requested from that team.
   *
   * The card owns the role list because nothing else on the page needs it. It is
   * pulled the first time a row exists or a picker opens — the same bargain as the
   * member list — and a failed fetch leaves the rows on plain id inputs rather than
   * taking the page down.
   */
  const props = defineProps<{ modelValue: GithubTeamMapping[]; readOnly: boolean }>();
  const emit = defineEmits<{ 'update:modelValue': [GithubTeamMapping[]] }>();

  const roles = ref<DiscordRole[]>([]);
  const rolesLoading = ref(false);
  const rolesFailed = ref(false);
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
   * A role nobody may mention only pings from a sender with "모두 멘션". Silent
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
      매핑된 팀이 없습니다. 팀 리뷰 요청이 오면 여기서 고른 역할을 부릅니다.
    </p>
    <div
      v-for="(row, index) in modelValue"
      :key="`team-${index}`"
      class="bg-muted/40 grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
      data-team-row
    >
      <div class="flex flex-col gap-1.5">
        <Label :for="`team-name-${index}`" class="sr-only">GitHub 팀</Label>
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
        <p class="text-muted-foreground text-xs">조직/팀-슬러그 — 조직은 저장소 소유자입니다</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label :for="`team-role-${index}`" class="sr-only">디스코드 역할</Label>
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
          <TriangleAlert class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            이 역할은 멘션이 허용돼 있지 않고 봇에 '모두 멘션' 권한이 없어 알림이 가지 않습니다.
          </span>
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        class="justify-self-end"
        :disabled="readOnly"
        aria-label="팀 매핑 삭제"
        @click="remove(index)"
      >
        <Trash2 />
      </Button>
    </div>
    <p v-if="rolesFailed" class="text-muted-foreground text-xs">
      역할 목록을 가져오지 못했습니다 — 역할 ID를 직접 입력하세요.
    </p>
  </div>
</template>
