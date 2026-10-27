import { describe, expect, it } from 'vitest';
import { SLUG_MAX_LENGTH, SLUG_PATTERN, slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Hello, World! 2026')).toBe('hello-world-2026');
  });

  it('strips accents', () => {
    expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu');
  });

  it('trims stray separators', () => {
    expect(slugify('  --Next.js & React--  ')).toBe('next-js-react');
  });

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugify(`${'word '.repeat(40)}`);

    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug).toMatch(SLUG_PATTERN);
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('uniqueSlug', () => {
  it('keeps a free slug', async () => {
    expect(await uniqueSlug('my-post', async () => false)).toBe('my-post');
  });

  it('appends the first free number', async () => {
    const taken = new Set(['my-post', 'my-post-2']);

    expect(await uniqueSlug('my-post', async (slug) => taken.has(slug))).toBe('my-post-3');
  });

  it('stays within the maximum length', async () => {
    const base = 'a'.repeat(SLUG_MAX_LENGTH);
    const slug = await uniqueSlug(base, async (candidate) => candidate === base);

    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith('-2')).toBe(true);
  });
});
