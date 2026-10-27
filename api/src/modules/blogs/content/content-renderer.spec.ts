import { describe, expect, it } from 'vitest';
import { ValidationException } from '../../../common/exceptions/validation.exception.js';
import { ContentRenderer } from './content-renderer.js';

const renderer = new ContentRenderer();
const doc = (...content: object[]) => ({ type: 'doc', content });
const paragraph = (...content: object[]) => ({ type: 'paragraph', content });
const text = (value: string, marks?: object[]) => ({ type: 'text', text: value, ...(marks && { marks }) });

const problemsOf = (document: unknown) => {
  try {
    renderer.render(document);
  } catch (error) {
    return (error as ValidationException).extras.details;
  }
  return [];
};

describe('ContentRenderer', () => {
  it('renders paragraphs, headings, lists and rules', () => {
    const { html } = renderer.render(
      doc(
        { type: 'heading', attrs: { level: 2 }, content: [text('Title')] },
        paragraph(text('Hello'), { type: 'hardBreak' }, text('world')),
        { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('one'))] }] },
        { type: 'horizontalRule' },
      ),
    );

    expect(html).toBe(
      '<h2>Title</h2><p>Hello<br>world</p><ul><li><p>one</p></li></ul><hr>',
    );
  });

  it('applies marks in order and escapes text', () => {
    const { html } = renderer.render(
      doc(paragraph(text('<b>&"x"</b>', [{ type: 'bold' }, { type: 'italic' }]))),
    );

    expect(html).toBe('<p><em><strong>&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;</strong></em></p>');
  });

  it('renders safe links with noopener and drops nothing silently', () => {
    const { html } = renderer.render(
      doc(paragraph(text('site', [{ type: 'link', attrs: { href: 'https://zoycoders.com/a?b=1&c=2', target: '_blank' } }]))),
    );

    expect(html).toBe(
      '<p><a href="https://zoycoders.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">site</a></p>',
    );
  });

  it.each(['javascript:alert(1)', 'data:text/html;base64,AAAA', '//evil.example', 'vbscript:x', 'ftp://x.example'])(
    'rejects the unsafe link %s',
    (href) => {
      const problems = problemsOf(doc(paragraph(text('x', [{ type: 'link', attrs: { href } }]))));

      expect(problems).toHaveLength(1);
      expect(problems[0].path).toContain('attrs.href');
    },
  );

  it('accepts site paths, anchors, mailto and tel links', () => {
    for (const href of ['/blog/a', '#section', 'mailto:hi@zoycoders.com', 'tel:+911234567890']) {
      expect(() => renderer.render(doc(paragraph(text('x', [{ type: 'link', attrs: { href } }]))))).not.toThrow();
    }
  });

  it('renders images only with an http(s) src and an alt text', () => {
    const { html } = renderer.render(
      doc({ type: 'image', attrs: { src: 'https://cdn.zoycoders.com/a.webp', alt: 'A "team" photo' } }),
    );

    expect(html).toBe('<img src="https://cdn.zoycoders.com/a.webp" alt="A &quot;team&quot; photo" loading="lazy">');
    expect(problemsOf(doc({ type: 'image', attrs: { src: 'javascript:1', alt: 'x' } }))[0].path).toContain('attrs.src');
    expect(problemsOf(doc({ type: 'image', attrs: { src: 'https://a.example/a.png' } }))[0].path).toContain('attrs.alt');
  });

  it('only allows heading levels 2 to 4', () => {
    expect(problemsOf(doc({ type: 'heading', attrs: { level: 1 }, content: [text('x')] }))[0].message).toContain('2, 3 or 4');
    expect(problemsOf(doc({ type: 'heading', attrs: { level: 6 }, content: [text('x')] }))).toHaveLength(1);
  });

  it('renders code blocks with a sanitised language class', () => {
    const { html } = renderer.render(doc({ type: 'codeBlock', attrs: { language: 'ts' }, content: [text('a < b')] }));
    const unsafe = renderer.render(doc({ type: 'codeBlock', attrs: { language: '"><script>' }, content: [text('x')] }));

    expect(html).toBe('<pre><code class="language-ts">a &lt; b</code></pre>');
    expect(unsafe.html).toBe('<pre><code>x</code></pre>');
  });

  it('rejects unknown nodes and marks with their path', () => {
    expect(problemsOf(doc({ type: 'script', content: [] }))).toEqual([
      { path: 'contentJson.content[0].type', message: 'unsupported node type "script"' },
    ]);
    expect(problemsOf(doc(paragraph(text('x', [{ type: 'highlight' }]))))[0].message).toBe('unsupported mark');
  });

  it('rejects anything that is not a doc', () => {
    expect(problemsOf({ type: 'paragraph' })).toEqual([{ path: 'contentJson', message: 'content must be a doc node' }]);
    expect(problemsOf('<p>html</p>')).toHaveLength(1);
    expect(problemsOf([])).toHaveLength(1);
  });

  it('collects every problem in one pass', () => {
    const problems = problemsOf(doc({ type: 'nope' }, { type: 'alsoNope' }, { type: 'heading', attrs: { level: 9 } }));

    expect(problems).toHaveLength(3);
  });

  it('rejects content that is too deeply nested', () => {
    let nested: object = paragraph(text('x'));
    for (let level = 0; level < 30; level++) {
      nested = { type: 'blockquote', content: [nested] };
    }

    expect(problemsOf(doc(nested))[0].message).toContain('too deeply nested');
  });

  it('estimates reading time from the word count', () => {
    const words = (count: number) => doc(paragraph(text(Array(count).fill('word').join(' '))));

    expect(renderer.render(doc()).readingTimeMin).toBe(0);
    expect(renderer.render(words(1)).readingTimeMin).toBe(1);
    expect(renderer.render(words(200)).readingTimeMin).toBe(1);
    expect(renderer.render(words(201)).readingTimeMin).toBe(2);
  });
});
