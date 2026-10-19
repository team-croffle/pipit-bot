<script setup lang="ts">
  import { PowerOff } from 'lucide-vue-next';
  import { computed } from 'vue';
  import { RouterLink, useRoute } from 'vue-router';

  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { FEATURE_LIST, PAGE_FEATURES, useFeatures } from '@/composables/use-features';

  /** Above a page whose feature is switched off: the page still opens, and says so. */
  const route = useRoute();
  const { isOff } = useFeatures();

  const off = computed(() =>
    (PAGE_FEATURES[route.path] ?? [])
      .filter((feature) => isOff(feature))
      .map((feature) => FEATURE_LIST.find((item) => item.key === feature)!.label),
  );
</script>

<template>
  <Alert v-if="off.length > 0" class="mb-5" data-feature-off>
    <PowerOff />
    <AlertTitle>{{ off.join(' · ') }} 꺼져 있음</AlertTitle>
    <AlertDescription>
      <span>
        설정은 바꿀 수 있지만 꺼져 있는 동안은 동작하지 않습니다.
        <RouterLink to="/settings" class="underline underline-offset-2">설정에서 켜기</RouterLink>
      </span>
    </AlertDescription>
  </Alert>
</template>
