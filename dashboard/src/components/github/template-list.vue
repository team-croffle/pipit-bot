<script setup lang="ts">
  import { computed, ref } from 'vue';

  import TemplateEditor from '@/components/github/template-editor.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import {
    cloneTemplate,
    emptyTemplate,
    eventLabels,
    renderTemplate,
    sampleFor,
  } from '@/lib/github-templates';
  import type {
    EmbedTemplate,
    GithubEventKey,
    GithubEventTemplates,
    GithubTemplateDefaults,
  } from '@/types';

  const props = defineProps<{
    templates: GithubEventTemplates;
    defaults: GithubTemplateDefaults | null;
    readOnly: boolean;
  }>();

  const emit = defineEmits<{ 'update:templates': [templates: GithubEventTemplates] }>();

  const editing = ref<GithubEventKey | null>(null);

  function defaultsFor(key: GithubEventKey): EmbedTemplate {
    return props.defaults?.templates[key] ?? emptyTemplate();
  }

  function variablesFor(key: GithubEventKey): string[] {
    return props.defaults?.variables[key] ?? [];
  }

  function labelFor(key: GithubEventKey): string {
    return props.defaults?.labels[key] ?? '';
  }

  /** The wording an event will actually send: its override, else the built-in default. */
  function effective(key: GithubEventKey): EmbedTemplate {
    return props.templates[key] ?? defaultsFor(key);
  }

  // One line that says what the message opens with, so the table is scannable without
  // opening eight dialogs.
  function summary(key: GithubEventKey): string {
    const template = effective(key);
    const values = sampleFor(key, variablesFor(key), labelFor(key));
    const line =
      renderTemplate(template.title, values) ||
      renderTemplate(template.description, values) ||
      renderTemplate(template.content, values);

    return line || '(비어 있음)';
  }

  function fieldCount(key: GithubEventKey): number {
    return effective(key).fields.filter((field) => field.name && field.value).length;
  }

  const rows = computed(() =>
    eventLabels.map((event) => ({
      ...event,
      inherited: props.templates[event.key] === undefined,
      summary: summary(event.key),
      fields: fieldCount(event.key),
    })),
  );

  function open(key: GithubEventKey): void {
    editing.value = key;
  }

  function save(key: GithubEventKey, template: EmbedTemplate): void {
    emit('update:templates', { ...props.templates, [key]: template });
    editing.value = null;
  }

  function reset(key: GithubEventKey): void {
    const next = { ...props.templates };
    delete next[key];
    emit('update:templates', next);
    editing.value = null;
  }
</script>

<template>
  <div class="overflow-x-auto">
    <Table class="min-w-160">
      <TableHeader>
        <TableRow>
          <TableHead class="w-56">이벤트</TableHead>
          <TableHead>미리보기</TableHead>
          <TableHead class="w-28">상태</TableHead>
          <TableHead class="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="row in rows" :key="row.key">
          <TableCell class="font-medium">{{ row.label }}</TableCell>
          <TableCell class="text-muted-foreground">
            <span class="line-clamp-1">{{ row.summary }}</span>
            <span v-if="row.fields > 0" class="text-xs">필드 {{ row.fields }}개</span>
          </TableCell>
          <TableCell>
            <Badge :variant="row.inherited ? 'secondary' : 'default'">
              {{ row.inherited ? '기본값' : '재정의' }}
            </Badge>
          </TableCell>
          <TableCell class="text-right">
            <Button variant="outline" size="sm" @click="open(row.key)">편집</Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>

  <!-- One editor, keyed by event: the dialog is remounted per event so its draft
       always starts from that event's wording. -->
  <TemplateEditor
    v-if="editing"
    :key="editing"
    :open="true"
    :event-key="editing"
    :event-label="eventLabels.find((event) => event.key === editing)?.label ?? ''"
    :template="cloneTemplate(effective(editing))"
    :variables="variablesFor(editing)"
    :read-only="readOnly"
    :inherited="templates[editing] === undefined"
    :sample-label="labelFor(editing)"
    @update:open="$event || (editing = null)"
    @save="save(editing, $event)"
    @reset="reset(editing)"
  />
</template>
