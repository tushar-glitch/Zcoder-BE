import { describe, expect, it } from 'vitest';
import { findPublishProblems, PublishCandidate } from './blog-publish-checklist.js';

const ready: PublishCandidate = {
  title: 'A proper title',
  excerpt: 'e'.repeat(60),
  readingTimeMin: 3,
  categoryId: 'category-id',
  authorId: 'author-id',
  coverImageId: 'cover-id',
  seoDescription: 's'.repeat(100),
};

describe('findPublishProblems', () => {
  it('accepts a complete blog', () => {
    expect(findPublishProblems(ready)).toEqual([]);
  });

  it('lists every missing field at once', () => {
    const paths = findPublishProblems({
      title: 'Hi',
      excerpt: null,
      readingTimeMin: 0,
      categoryId: null,
      authorId: null,
      coverImageId: null,
      seoDescription: null,
    }).map((problem) => problem.path);

    expect(paths).toEqual(['title', 'excerpt', 'contentJson', 'categoryId', 'authorId', 'coverImageId', 'seoDescription']);
  });

  it.each([
    ['excerpt', { excerpt: 'e'.repeat(49) }],
    ['excerpt', { excerpt: 'e'.repeat(301) }],
    ['seoDescription', { seoDescription: 's'.repeat(49) }],
    ['seoDescription', { seoDescription: 's'.repeat(161) }],
  ])('enforces the %s length bounds', (path, override) => {
    expect(findPublishProblems({ ...ready, ...override }).map((problem) => problem.path)).toEqual([path]);
  });
});
