/**
 * Discord's markdown, parsed into nodes for the preview.
 *
 * WHY a parser of our own and not a library: Discord's dialect is small and its own —
 * `||spoiler||`, `-# subtext`, `>>> ` quotes, underline on `__`, no images, no tables,
 * no setext headings. A general markdown library gets those wrong in both directions
 * and then needs sanitising, because it produces HTML. This produces a tree and the
 * renderer turns it into elements itself, so no string ever reaches `v-html`.
 *
 * The bot does not use this — Discord renders the real message. This only has to
 * agree with what Discord shows, not with a specification.
 */

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: InlineNode[] }
  | { type: 'autolink'; href: string }
  | { type: 'strong' | 'em' | 'underline' | 'strike' | 'spoiler'; children: InlineNode[] };

export type BlockNode =
  | { type: 'line'; children: InlineNode[] }
  | { type: 'heading'; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: 'subtext'; children: InlineNode[] }
  | { type: 'quote'; children: BlockNode[] }
  | { type: 'codeblock'; lang: string; text: string }
  | { type: 'list'; ordered: boolean; items: { depth: number; children: InlineNode[] }[] };

type WrapType = 'strong' | 'em' | 'underline' | 'strike' | 'spoiler';

// Longest first, so `**` is tried before `*` and `***` before both.
const WRAPPERS: { open: string; types: WrapType[] }[] = [
  { open: '***', types: ['em', 'strong'] },
  { open: '||', types: ['spoiler'] },
  { open: '**', types: ['strong'] },
  { open: '__', types: ['underline'] },
  { open: '~~', types: ['strike'] },
  { open: '*', types: ['em'] },
  { open: '_', types: ['em'] },
];

const ESCAPABLE = /[\\`*_~|[\]()>#-]/;
const LINK = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/;
const AUTOLINK = /^https?:\/\/[^\s<>]+/;
const WORD = /[\p{L}\p{N}]/u;

/**
 * Where a delimiter closes. A one-character delimiter skips its doubled form, so
 * `*a **b** c*` closes at the last star and not inside the bold.
 */
function findClose(text: string, from: number, open: string): number {
  if (open.length > 1) {
    return text.indexOf(open, from);
  }

  for (let index = from; index < text.length; index += 1) {
    if (text[index] !== open) {
      continue;
    }

    if (text[index + 1] === open) {
      index += 1;
      continue;
    }

    // `_` only closes at a word edge — snake_case_names stay literal.
    if (open === '_' && WORD.test(text[index + 1] ?? '')) {
      continue;
    }

    return index;
  }

  return -1;
}

function wrap(types: WrapType[], children: InlineNode[]): InlineNode {
  const [outer, ...rest] = types;
  if (!outer) {
    throw new Error('wrap needs at least one type');
  }

  return { type: outer, children: rest.length > 0 ? [wrap(rest, children)] : children };
}

/** A URL's trailing sentence punctuation belongs to the sentence, not the link. */
function trimUrl(url: string): string {
  let end = url.length;
  while (end > 0 && /[.,;:!?'"]/.test(url[end - 1] ?? '')) {
    end -= 1;
  }

  if (url[end - 1] === ')' && !url.slice(0, end).includes('(')) {
    end -= 1;
  }

  return url.slice(0, end);
}

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = '';
  const flush = (): void => {
    if (buffer) {
      nodes.push({ type: 'text', text: buffer });
      buffer = '';
    }
  };

  let index = 0;
  while (index < text.length) {
    const char = text[index] ?? '';
    const rest = text.slice(index);

    if (char === '\\' && ESCAPABLE.test(text[index + 1] ?? '')) {
      buffer += text[index + 1];
      index += 2;
      continue;
    }

    if (char === '`') {
      const run = /^`+/.exec(rest)?.[0] ?? '`';
      const close = text.indexOf(run, index + run.length);
      if (close !== -1 && close > index + run.length) {
        flush();
        nodes.push({ type: 'code', text: text.slice(index + run.length, close) });
        index = close + run.length;
        continue;
      }
    }

    if (char === '[') {
      const match = LINK.exec(rest);
      if (match) {
        flush();
        nodes.push({ type: 'link', href: match[2] ?? '', children: parseInline(match[1] ?? '') });
        index += match[0].length;
        continue;
      }
    }

    if (char === 'h') {
      const match = AUTOLINK.exec(rest);
      if (match) {
        const href = trimUrl(match[0]);
        flush();
        nodes.push({ type: 'autolink', href });
        index += href.length;
        continue;
      }
    }

    const wrapper = WRAPPERS.find((candidate) => rest.startsWith(candidate.open));
    if (wrapper) {
      const inner = index + wrapper.open.length;
      const startsAtWordEdge =
        wrapper.open !== '_' || !WORD.test(index > 0 ? (text[index - 1] ?? '') : '');
      const close = startsAtWordEdge ? findClose(text, inner, wrapper.open) : -1;
      // An empty pair, or one whose content is only whitespace, is literal in Discord.
      if (close !== -1 && text.slice(inner, close).trim() !== '') {
        flush();
        nodes.push(wrap(wrapper.types, parseInline(text.slice(inner, close))));
        index = close + wrapper.open.length;
        continue;
      }
    }

    buffer += char;
    index += 1;
  }

  flush();
  return nodes;
}

const HEADING = /^(#{1,3}) +(.*)$/;
const SUBTEXT = /^-# +(.*)$/;
const LIST_ITEM = /^( *)(?:[-*]|\d+\.) +(.*)$/;
const ORDERED_ITEM = /^ *\d+\. /;
const QUOTE = /^> ?/;

/**
 * A fenced block runs from the opening fence to the next one — Discord does not
 * require the closing fence to sit on its own line. The first line is a language
 * tag when it looks like one; the language is not used for anything but is taken
 * off the code.
 */
function readCodeBlock(
  lines: string[],
  start: number,
): { block: BlockNode; next: number; tail: string | undefined } {
  const remainder = lines.slice(start).join('\n');
  const close = remainder.indexOf('```', 3);
  const body = close === -1 ? remainder.slice(3) : remainder.slice(3, close);

  const firstBreak = body.indexOf('\n');
  let lang = '';
  let code = body;
  if (firstBreak !== -1 && /^[\w+#.-]*$/.test(body.slice(0, firstBreak))) {
    lang = body.slice(0, firstBreak);
    code = body.slice(firstBreak + 1);
  }

  const consumed = close === -1 ? remainder : remainder.slice(0, close + 3);
  const consumedLines = consumed.split('\n').length;
  const lastLine = lines[start + consumedLines - 1] ?? '';
  const lineEnd = consumed.length - consumed.lastIndexOf('\n') - 1;
  const tail = close === -1 ? '' : lastLine.slice(lineEnd);

  return {
    block: { type: 'codeblock', lang, text: code.replace(/^\n/, '').replace(/\n$/, '') },
    next: start + consumedLines,
    tail: tail.trim() === '' ? undefined : tail,
  };
}

export function parseBlocks(text: string, insideQuote = false): BlockNode[] {
  const lines = text.split('\n');
  const blocks: BlockNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';

    if (line.startsWith('```')) {
      const { block, next, tail } = readCodeBlock(lines, index);
      blocks.push(block);
      index = next;
      if (tail !== undefined) {
        // Text after the closing fence on the same line is its own line.
        lines.splice(index, 0, tail);
      }
      continue;
    }

    if (!insideQuote && line.startsWith('>>> ')) {
      const rest = [line.slice(4), ...lines.slice(index + 1)].join('\n');
      blocks.push({ type: 'quote', children: parseBlocks(rest, true) });
      break;
    }

    if (!insideQuote && (QUOTE.test(line) && line !== '>' ? true : line === '>')) {
      const quoted: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index] ?? '')) {
        quoted.push((lines[index] ?? '').replace(QUOTE, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', children: parseBlocks(quoted.join('\n'), true) });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = (heading[1]?.length ?? 1) as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, children: parseInline(heading[2] ?? '') });
      index += 1;
      continue;
    }

    const subtext = SUBTEXT.exec(line);
    if (subtext) {
      blocks.push({ type: 'subtext', children: parseInline(subtext[1] ?? '') });
      index += 1;
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const ordered = ORDERED_ITEM.test(line);
      const items: { depth: number; children: InlineNode[] }[] = [];
      while (index < lines.length) {
        const item = LIST_ITEM.exec(lines[index] ?? '');
        if (!item || ORDERED_ITEM.test(lines[index] ?? '') !== ordered) {
          break;
        }

        // Discord nests one level, on any indent of two or more spaces.
        items.push({
          depth: (item[1]?.length ?? 0) >= 2 ? 1 : 0,
          children: parseInline(item[2] ?? ''),
        });
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    blocks.push({ type: 'line', children: parseInline(line) });
    index += 1;
  }

  return blocks;
}
