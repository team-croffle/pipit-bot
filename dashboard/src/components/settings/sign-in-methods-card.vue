<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { I18nT, useI18n } from 'vue-i18n';

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

  const { t } = useI18n();
  const label = (method: MethodState['method']) => t(`settings.signIn.${method}.label`);
  const help = (method: MethodState['method']) => t(`settings.signIn.${method}.help`);

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
      error.value = cause instanceof Error ? cause.message : t('settings.signIn.loadFailed');
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
      error.value = cause instanceof Error ? cause.message : t('settings.signIn.saveFailed');
    } finally {
      busy.value = false;
    }
  }

  onMounted(load);
</script>

<template>
  <Card data-sign-in-methods>
    <CardHeader>
      <CardTitle class="text-base">{{ t('settings.signIn.title') }}</CardTitle>
      <CardDescription>
        <I18nT keypath="settings.signIn.description" scope="global">
          <template #file>
            <code class="font-gothic">data/auth-settings.json</code>
          </template>
        </I18nT>
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
          {{ t('settings.signIn.fallback') }}
        </p>
        <div class="flex flex-col">
          <div
            v-for="state in answer?.methods ?? []"
            :key="state.method"
            class="flex items-center justify-between gap-4 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ label(state.method) }}</p>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ help(state.method) }}
              </p>
              <p
                v-if="!state.available"
                class="text-muted-foreground mt-0.5 text-xs"
                :data-unavailable="state.method"
              >
                {{ t('settings.signIn.unavailable', { reason: state.unavailableReason }) }}
              </p>
              <p v-else-if="lastOn(state)" class="text-muted-foreground mt-0.5 text-xs">
                {{ t('settings.signIn.lastOn') }}
              </p>
            </div>
            <Switch
              :data-method="state.method"
              :aria-label="label(state.method)"
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
