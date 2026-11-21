<script setup lang="ts">
  import { PowerOff } from 'lucide-vue-next';
  import { computed } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { RouterLink, useRoute } from 'vue-router';

  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { FEATURE_LIST, PAGE_FEATURES, useFeatures } from '@/composables/use-features';

  /** Above a page whose feature is switched off: the page still opens, and says so. */
  const route = useRoute();
  const { isOff } = useFeatures();
  const { t } = useI18n();

  const off = computed(() =>
    (PAGE_FEATURES[route.path] ?? [])
      .filter((feature) => isOff(feature))
      .map((feature) => FEATURE_LIST.find((item) => item.key === feature)!.label),
  );
</script>

<template>
  <Alert v-if="off.length > 0" class="mb-5" data-feature-off>
    <PowerOff />
    <AlertTitle>{{ t('common.featureOff', { features: off.join(' · ') }) }}</AlertTitle>
    <AlertDescription>
      <span>
        {{ t('common.featureOffBody') }}
        <RouterLink to="/settings" class="underline underline-offset-2">{{
          t('common.featureOffLink')
        }}</RouterLink>
      </span>
    </AlertDescription>
  </Alert>
</template>
