<script setup lang="ts">
  import { Languages } from 'lucide-vue-next';
  import { ref } from 'vue';
  import { useI18n } from 'vue-i18n';

  import { putJson } from '@/api';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { resolveLanguage, setLanguage } from '@/i18n';
  import type { DashboardIdentity } from '@/types';

  /**
   * The person's own dashboard language (users.locale): Korean, English, or the server's
   * default. Saved at once; the page switches without a reload.
   */
  const me = defineModel<DashboardIdentity>('me', { required: true });
  const { t } = useI18n();
  const SERVER = 'server';
  const failed = ref(false);

  async function choose(value: unknown): Promise<void> {
    const locale = value === SERVER ? null : (value as 'en' | 'ko');
    try {
      await putJson('/api/me/language', { locale });
      me.value = { ...me.value, locale };
      setLanguage(resolveLanguage(locale, me.value.dashboardLanguage));
      failed.value = false;
    } catch {
      failed.value = true;
    }
  }
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        :aria-label="t('common.languageChoose')"
        :title="failed ? t('common.languageSaveFailed') : t('common.language')"
        data-language-menu
      >
        <Languages :class="failed ? 'text-destructive' : ''" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-40">
      <DropdownMenuLabel>{{ t('common.language') }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup :model-value="me.locale ?? SERVER" @update:model-value="choose">
        <DropdownMenuRadioItem :value="SERVER" data-language-option="server">
          {{ t('common.languageServer') }}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="ko" data-language-option="ko">한국어</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="en" data-language-option="en">English</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
