import { Injectable } from '@nestjs/common';
import { ValidationDetail, ValidationException } from '../../../common/exceptions/validation.exception.js';

export interface RenderedContent {
  html: string;
  readingTimeMin: number;
}

interface TiptapMark {
  type?: unknown;
  attrs?: Record<string, unknown>;
}

interface TiptapNode {
  type?: unknown;
  attrs?: Record<string, unknown>;
  content?: unknown;
  marks?: unknown;
  text?: unknown;
}

class RenderContext {
  readonly problems: ValidationDetail[] = [];
  readonly words: string[] = [];
  nodes = 0;

  fail(path: string, message: string): string {
    this.problems.push({ path, message });
    return '';
  }
}

type NodeRenderer = (node: TiptapNode, inner: string, context: RenderContext, path: string) => string;
type MarkRenderer = (inner: string, attrs: Record<string, unknown> | undefined, context: RenderContext, path: string) => string;

const MAX_DEPTH = 20;
const MAX_NODES = 5000;
const MAX_PROBLEMS = 20;
const WORDS_PER_MINUTE = 200;
const HEADING_LEVELS = [2, 3, 4];
const CODE_LANGUAGE = /^[a-z0-9+#-]{1,20}$/i;

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function parseHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const href = value.trim();
  if (/^(mailto:|tel:)[^\s]+$/i.test(href) || /^#[\w-]*$/.test(href) || /^\/(?!\/)[^\s]*$/.test(href)) {
    return href;
  }
  return parseHttpUrl(href);
}

const blockTag =
  (tag: string): NodeRenderer =>
  (_node, inner) =>
    `<${tag}>${inner}</${tag}>`;

const NODE_RENDERERS: Record<string, NodeRenderer> = {
  doc: (_node, inner) => inner,
  paragraph: blockTag('p'),
  bulletList: blockTag('ul'),
  orderedList: blockTag('ol'),
  listItem: blockTag('li'),
  blockquote: blockTag('blockquote'),
  hardBreak: () => '<br>',
  horizontalRule: () => '<hr>',
  heading: ({ attrs }, inner, context, path) => {
    const level = Number(attrs?.level);
    if (!HEADING_LEVELS.includes(level)) {
      return context.fail(`${path}.attrs.level`, 'heading level must be 2, 3 or 4');
    }
    return `<h${level}>${inner}</h${level}>`;
  },
  codeBlock: ({ attrs }, inner) => {
    const language = typeof attrs?.language === 'string' && CODE_LANGUAGE.test(attrs.language) ? attrs.language : null;
    return `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${inner}</code></pre>`;
  },
  image: ({ attrs }, _inner, context, path) => {
    const src = parseHttpUrl(attrs?.src);
    const alt = typeof attrs?.alt === 'string' ? attrs.alt.trim() : '';
    if (!src) {
      return context.fail(`${path}.attrs.src`, 'image src must be an http or https URL');
    }
    if (!alt) {
      return context.fail(`${path}.attrs.alt`, 'image alt text is required');
    }
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">`;
  },
};

const wrapMark =
  (tag: string): MarkRenderer =>
  (inner) =>
    `<${tag}>${inner}</${tag}>`;

const MARK_RENDERERS: Record<string, MarkRenderer> = {
  bold: wrapMark('strong'),
  italic: wrapMark('em'),
  underline: wrapMark('u'),
  strike: wrapMark('s'),
  code: wrapMark('code'),
  link: (inner, attrs, context, path) => {
    const href = safeHref(attrs?.href);
    if (!href) {
      return context.fail(`${path}.attrs.href`, 'link href must be http(s), mailto, tel or a site path');
    }
    const target = attrs?.target === '_blank' ? ' target="_blank"' : '';
    return `<a href="${escapeHtml(href)}"${target} rel="noopener noreferrer">${inner}</a>`;
  },
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

@Injectable()
export class ContentRenderer {
  render(document: unknown): RenderedContent {
    const context = new RenderContext();
    const root = isObject(document) ? (document as TiptapNode) : null;

    const html =
      root?.type === 'doc' ? this.renderNode(root, 'contentJson', 0, context) : context.fail('contentJson', 'content must be a doc node');

    if (context.problems.length > 0) {
      throw new ValidationException(context.problems.slice(0, MAX_PROBLEMS));
    }
    return { html, readingTimeMin: this.readingTime(context.words.length) };
  }

  private renderNode(node: TiptapNode, path: string, depth: number, context: RenderContext): string {
    if (depth > MAX_DEPTH || ++context.nodes > MAX_NODES) {
      return context.fail(path, 'content is too deeply nested or too large');
    }
    if (node.type === 'text') {
      return this.renderText(node, path, context);
    }

    const render = typeof node.type === 'string' ? NODE_RENDERERS[node.type] : undefined;
    if (!render) {
      return context.fail(`${path}.type`, `unsupported node type "${String(node.type)}"`);
    }

    const inner = this.renderChildren(node.content, path, depth, context);
    return render(node, inner, context, path);
  }

  private renderChildren(content: unknown, path: string, depth: number, context: RenderContext): string {
    if (content === undefined) {
      return '';
    }
    if (!Array.isArray(content)) {
      return context.fail(`${path}.content`, 'content must be an array');
    }
    return content
      .map((child, index) =>
        isObject(child)
          ? this.renderNode(child as TiptapNode, `${path}.content[${index}]`, depth + 1, context)
          : context.fail(`${path}.content[${index}]`, 'node must be an object'),
      )
      .join('');
  }

  private renderText(node: TiptapNode, path: string, context: RenderContext): string {
    if (typeof node.text !== 'string') {
      return context.fail(`${path}.text`, 'text node needs a string');
    }
    context.words.push(...node.text.split(/\s+/).filter(Boolean));

    const marks = node.marks === undefined ? [] : node.marks;
    if (!Array.isArray(marks)) {
      return context.fail(`${path}.marks`, 'marks must be an array');
    }

    return marks.reduce<string>((inner, mark: TiptapMark, index) => {
      const markPath = `${path}.marks[${index}]`;
      const render = isObject(mark) && typeof mark.type === 'string' ? MARK_RENDERERS[mark.type] : undefined;
      return render ? render(inner, mark.attrs, context, markPath) : context.fail(`${markPath}.type`, 'unsupported mark');
    }, escapeHtml(node.text));
  }

  private readingTime(wordCount: number): number {
    return wordCount === 0 ? 0 : Math.ceil(wordCount / WORDS_PER_MINUTE);
  }
}
