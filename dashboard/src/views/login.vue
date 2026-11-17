<script setup lang="ts">
  import { KeyRound, LogIn } from 'lucide-vue-next';
  import { computed, onMounted, ref } from 'vue';
  import { useRoute } from 'vue-router';

  import BrandMark from '@/components/layout/brand-mark.vue';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Separator } from '@/components/ui/separator';
  import { Skeleton } from '@/components/ui/skeleton';
  import { useTheme } from '@/composables/use-theme';
  import {
    describeError,
    fetchMethods,
    safeNext,
    signInWithPassword,
    signInWithProvider,
    type OfferedMethod,
    type SignInMethod,
  } from '@/lib/sign-in';

  /**
   * The sign-in page (v0.8.2). It offers only the methods that are switched on, and sends
   * the person back to where they were going. English, unlike the rest of the dashboard
   * for now (2026-11-18, the team; every page gets a language in v0.8.3).
   */

  // The shell's theme toggle is not on this page; this keeps the saved or system theme.
  useTheme();

  const route = useRoute();
  const next = computed(() => safeNext(route.query.next));

  const methods = ref<OfferedMethod[]>([]);
  const loading = ref(true);
  const loadError = ref('');
  const error = ref(typeof route.query.error === 'string' ? describeError(route.query.error) : '');
  const busy = ref<SignInMethod | null>(null);
  const username = ref('');
  const password = ref('');

  const hasPassword = computed(() => methods.value.some((m) => m.method === 'password'));
  const providers = computed(() => methods.value.filter((m) => m.method !== 'password'));

  const PROVIDER_NAMES: Record<string, string> = { discord: 'Discord', github: 'GitHub' };
  function providerName(method: OfferedMethod): string {
    return method.label ?? PROVIDER_NAMES[method.method] ?? method.method;
  }

  onMounted(async () => {
    try {
      // Already signed in: nothing to do here.
      const me = await fetch('/api/me', { credentials: 'include' });
      if (me.ok) {
        window.location.replace(next.value);
        return;
      }
      methods.value = await fetchMethods();
    } catch {
      loadError.value = 'The sign-in options could not be loaded. Reload the page to try again.';
    } finally {
      loading.value = false;
    }
  });

  async function submitPassword() {
    if (busy.value) {
      return;
    }
    busy.value = 'password';
    error.value = '';
    try {
      await signInWithPassword(username.value.trim(), password.value);
      window.location.replace(next.value);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Signing in failed.';
      password.value = '';
      busy.value = null;
    }
  }

  async function startProvider(method: SignInMethod) {
    if (busy.value) {
      return;
    }
    busy.value = method;
    error.value = '';
    try {
      await signInWithProvider(method, next.value);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Signing in failed.';
      busy.value = null;
    }
  }
</script>

<template>
  <main class="bg-background flex min-h-dvh items-center justify-center px-4 py-10">
    <div class="flex w-full max-w-sm flex-col gap-6">
      <div class="flex items-center justify-center gap-3">
        <BrandMark :size="40" />
        <span class="text-xl font-semibold tracking-tight">Pipit</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Sign in to the team dashboard.</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-5">
          <Alert v-if="error" variant="destructive" role="alert">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>

          <div v-if="loading" class="flex flex-col gap-3" role="status" aria-live="polite">
            <Skeleton class="h-9 w-full" />
            <Skeleton class="h-9 w-full" />
            <span class="sr-only">Loading…</span>
          </div>

          <p v-else-if="loadError" class="text-destructive text-sm" role="alert">
            {{ loadError }}
          </p>

          <p v-else-if="methods.length === 0" class="text-muted-foreground text-sm">
            No sign-in method is available. Ask the operator to check the server.
          </p>

          <template v-else>
            <form v-if="hasPassword" class="flex flex-col gap-4" @submit.prevent="submitPassword">
              <div class="flex flex-col gap-2">
                <Label for="login-username">User name</Label>
                <Input
                  id="login-username"
                  v-model="username"
                  autocomplete="username"
                  autocapitalize="none"
                  spellcheck="false"
                  required
                />
              </div>
              <div class="flex flex-col gap-2">
                <Label for="login-password">Password</Label>
                <Input
                  id="login-password"
                  v-model="password"
                  type="password"
                  autocomplete="current-password"
                  required
                />
              </div>
              <Button type="submit" :disabled="busy !== null">
                <KeyRound />
                {{ busy === 'password' ? 'Signing in…' : 'Sign in' }}
              </Button>
            </form>

            <div v-if="hasPassword && providers.length > 0" class="flex items-center gap-3">
              <Separator class="flex-1" />
              <span class="text-muted-foreground text-xs">or</span>
              <Separator class="flex-1" />
            </div>

            <div v-if="providers.length > 0" class="flex flex-col gap-2">
              <Button
                v-for="provider in providers"
                :key="provider.method"
                variant="outline"
                :disabled="busy !== null"
                @click="startProvider(provider.method)"
              >
                <LogIn />
                {{
                  busy === provider.method
                    ? 'Redirecting…'
                    : `Continue with ${providerName(provider)}`
                }}
              </Button>
            </div>
          </template>
        </CardContent>
      </Card>
    </div>
  </main>
</template>
