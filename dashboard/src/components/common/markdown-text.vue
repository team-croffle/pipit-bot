<script lang="ts">
  /**
   * Renders text the way Discord will — markdown and `:name:` emoji — for the parts
   * of a message where Discord actually applies markdown: the plain line, the
   * description and field values. Titles, field names and footers are plain text in
   * Discord and keep using EmojiText directly.
   *
   * WHY a render function: the parsed tree is recursive (bold inside a quote inside a
   * list), which a template expresses badly. Building elements with `h` keeps the
   * whole thing free of `v-html` — every string ends up as a text node.
   */
  import { computed, defineComponent, h, type VNodeChild } from 'vue';

  import EmojiText from '@/components/common/emoji-text.vue';
  import { parseBlocks, type BlockNode, type InlineNode } from '@/lib/discord-markdown';

  const LINK_CLASS =
    'text-info decoration-info/40 hover:decoration-info underline underline-offset-2';

  const HEADING_CLASS: Record<1 | 2 | 3, string> = {
    1: 'text-lg font-bold leading-tight',
    2: 'text-base font-bold leading-tight',
    3: 'text-sm font-bold leading-tight',
  };

  function renderInline(nodes: InlineNode[]): VNodeChild[] {
    return nodes.map((node) => {
      switch (node.type) {
        case 'text':
          return h(EmojiText, { text: node.text });
        case 'code':
          return h(
            'code',
            { class: 'bg-muted rounded px-1 py-0.5 font-mono text-[0.85em] font-normal' },
            node.text,
          );
        case 'link':
          return h(
            'a',
            { href: node.href, target: '_blank', rel: 'noreferrer noopener', class: LINK_CLASS },
            renderInline(node.children),
          );
        case 'autolink':
          return h(
            'a',
            { href: node.href, target: '_blank', rel: 'noreferrer noopener', class: LINK_CLASS },
            node.href,
          );
        case 'strong':
          return h('strong', { class: 'font-bold' }, renderInline(node.children));
        case 'em':
          return h('em', renderInline(node.children));
        case 'underline':
          return h('u', renderInline(node.children));
        case 'strike':
          return h('s', renderInline(node.children));
        case 'spoiler':
          // Hidden until hovered, the way Discord hides it until clicked.
          return h(
            'span',
            {
              class:
                'bg-foreground/80 text-foreground/0 hover:bg-muted hover:text-inherit rounded px-0.5 transition-colors',
              title: '스포일러',
            },
            renderInline(node.children),
          );
      }
    });
  }

  function renderBlock(block: BlockNode): VNodeChild {
    switch (block.type) {
      case 'line':
        // An empty line still takes a line's height, as it does in Discord.
        return h('div', block.children.length > 0 ? renderInline(block.children) : '​');
      case 'heading':
        return h(
          `h${block.level}`,
          { class: `${HEADING_CLASS[block.level]} mt-2 mb-1 first:mt-0` },
          renderInline(block.children),
        );
      case 'subtext':
        return h(
          'div',
          { class: 'text-muted-foreground text-[0.8em]' },
          renderInline(block.children),
        );
      case 'quote':
        return h(
          'blockquote',
          { class: 'border-border my-0.5 border-l-4 pl-3' },
          block.children.map(renderBlock),
        );
      case 'codeblock':
        return h(
          'pre',
          {
            class:
              'bg-muted my-1 overflow-x-auto rounded-md border px-3 py-2 font-mono text-[0.85em] whitespace-pre',
          },
          h('code', block.text),
        );
      case 'list':
        return h(
          block.ordered ? 'ol' : 'ul',
          { class: `${block.ordered ? 'list-decimal' : 'list-disc'} my-0.5 pl-5` },
          block.items.map((item) =>
            h('li', { class: item.depth > 0 ? 'ml-4' : undefined }, renderInline(item.children)),
          ),
        );
    }
  }

  export default defineComponent({
    name: 'MarkdownText',
    props: {
      text: { type: String, required: true },
    },
    setup(props) {
      const blocks = computed(() => parseBlocks(props.text));
      return () => h('div', { class: 'wrap-break-word min-w-0' }, blocks.value.map(renderBlock));
    },
  });
</script>
