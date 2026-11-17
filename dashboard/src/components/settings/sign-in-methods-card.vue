<script setup lang="ts">
  import { onMounted, ref } from 'vue';

  import { fetchJson, putJson } from '@/api';
  import StateBlock from '@/components/common/state-block.vue';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Switch } from '@/components/ui/switch';

  /**
   * Which sign-in methods the sign-in page offers (data/auth-settings.json). A method
   * without its environment cannot be switched on, and the last one on cannot be
   * switched off — both are shown disabled with the reason.
   */

  interface MethodState {
    method: 'password' | 'oidc' | 'discord' | 'github';
    enabled: boolean;
    available: boolean;
    active: boolean;
    unavailableReason: string | null;
  }
  interface Answer {
    methods: MethodState[];
    fallback: boolean;
  }

  const { readOnly } = defineProps<{ readOnly: boolean }>();

  const LABELS: Record<MethodState['method'], { label: string; help: string }> = {
    password: { label: '비밀번호', help: '관리자가 사용자 페이지에서 만든 계정' },
    oidc: { label: 'SSO (OIDC)', help: '설정한 ID 제공자(Dex 등)로 로그인' },
    discord: { label: 'Discord', help: '서버 멤버만 — 처음이면 viewer로 만들어집니다' },
    github: { label: 'GitHub', help: '사용자에 GitHub 로그인이 등록된 사람만' },
  };

  const answer = ref<Answer | null>(null);
  const error = ref('');
  const busy = ref(false);

  const lastOn = (state: MethodState) =>
    state.active && (answer.value?.methods.filter((m) => m.active).length ?? 0) === 1;

  async function load(): Promise<void> {
    try {
      answer.value = await fetchJson<Answer>('/api/settings/auth-methods');
      error.value = '';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '로그인 방법을 불러오지 못했습니다.';
    }
  }

  async function toggle(method: MethodState['method'], on: boolean): Promise<void> {
    busy.value = true;
    try {
      answer.value = await putJson<Answer>('/api/settings/auth-methods', {
        methods: { [method]: on },
      });
      error.value = '';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '저장하지 못했습니다.';
    } finally {
      busy.value = false;
    }
  }

  onMounted(load);
</script>

<template>
  <Card data-sign-in-methods>
    <CardHeader>
      <CardTitle class="text-base">로그인 방법</CardTitle>
      <CardDescription>
        로그인 화면에 보일 방법입니다. 하나는 항상 켜져 있어야 합니다. 잠겼다면 서버의
        <code class="font-gothic">data/auth-settings.json</code>을 고치고 다시 시작하세요.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col">
      <StateBlock :loading="!answer && !error" :error="answer ? '' : error">
        <p
          v-if="answer?.fallback"
          class="text-warning mb-3 text-xs"
          role="status"
          data-sign-in-fallback
        >
          설정 파일을 쓸 수 없어(손상되었거나 모두 꺼짐) 설정된 방법을 모두 켠 상태로 시작했습니다.
          여기서 저장하면 파일이 다시 만들어집니다.
        </p>
        <div class="flex flex-col">
          <div
            v-for="state in answer?.methods ?? []"
            :key="state.method"
            class="flex items-center justify-between gap-4 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ LABELS[state.method].label }}</p>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ LABELS[state.method].help }}
              </p>
              <p
                v-if="!state.available"
                class="text-muted-foreground mt-0.5 text-xs"
                :data-unavailable="state.method"
              >
                사용할 수 없음 — {{ state.unavailableReason }}
              </p>
              <p v-else-if="lastOn(state)" class="text-muted-foreground mt-0.5 text-xs">
                마지막으로 켜진 방법이라 끌 수 없습니다.
              </p>
            </div>
            <Switch
              :data-method="state.method"
              :aria-label="LABELS[state.method].label"
              :model-value="state.active"
              :disabled="readOnly || busy || !state.available || lastOn(state)"
              @update:model-value="(value) => toggle(state.method, value === true)"
            />
          </div>
        </div>
      </StateBlock>
      <p v-if="answer && error" class="text-destructive mt-3 text-xs" role="alert">
        {{ error }}
      </p>
    </CardContent>
  </Card>
</template>
