<script setup lang="ts">
  import { RouterLink } from 'vue-router';

  import { Badge } from '@/components/ui/badge';
  import { navSections } from '@/nav';

  const emit = defineEmits<{ navigate: [] }>();

  const linkClass =
    'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50';
  const activeClass =
    '[&.router-link-active]:bg-sidebar-accent [&.router-link-active]:text-sidebar-accent-foreground';
  const exactActiveClass =
    '[&.router-link-exact-active]:bg-sidebar-accent [&.router-link-exact-active]:text-sidebar-accent-foreground';
</script>

<template>
  <nav class="flex flex-col gap-5">
    <div
      v-for="section in navSections"
      :key="section.title || 'root'"
      class="flex flex-col gap-0.5"
    >
      <p
        v-if="section.title"
        class="text-muted-foreground/80 px-2.5 pb-1 text-[0.68rem] font-semibold tracking-wider uppercase"
      >
        {{ section.title }}
      </p>
      <RouterLink
        v-for="item in section.items"
        :key="item.to"
        :to="item.to"
        :class="[linkClass, item.exact ? exactActiveClass : activeClass]"
        @click="emit('navigate')"
      >
        <component :is="item.icon" class="size-4 shrink-0" />
        <span class="truncate">{{ item.label }}</span>
        <Badge v-if="item.planned" variant="outline" class="ml-auto px-1.5 py-0 text-[0.65rem]">
          {{ item.planned }}
        </Badge>
      </RouterLink>
    </div>
  </nav>
</template>
