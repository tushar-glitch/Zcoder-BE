import type { ValidationDetail } from '../../common/exceptions/validation.exception.js';

export interface PublishCandidate {
  title: string;
  excerpt: string | null;
  readingTimeMin: number;
  categoryId: string | null;
  authorId: string | null;
  coverImageId: string | null;
  seoDescription: string | null;
}

const MIN_TITLE = 5;
const EXCERPT = { min: 50, max: 300 };
const SEO_DESCRIPTION = { min: 50, max: 160 };

export function findPublishProblems(blog: PublishCandidate): ValidationDetail[] {
  const problems: ValidationDetail[] = [];
  const require = (ok: boolean, path: string, message: string): void => {
    if (!ok) {
      problems.push({ path, message });
    }
  };
  const within = (value: string | null, { min, max }: { min: number; max: number }): boolean =>
    value !== null && value.length >= min && value.length <= max;

  require(blog.title.length >= MIN_TITLE, 'title', `title must be at least ${MIN_TITLE} characters to publish`);
  require(within(blog.excerpt, EXCERPT), 'excerpt', `excerpt must be ${EXCERPT.min} to ${EXCERPT.max} characters to publish`);
  require(blog.readingTimeMin > 0, 'contentJson', 'content must contain text to publish');
  require(blog.categoryId !== null, 'categoryId', 'a category is required to publish');
  require(blog.authorId !== null, 'authorId', 'an author is required to publish');
  require(blog.coverImageId !== null, 'coverImageId', 'a cover image is required to publish');
  require(
    within(blog.seoDescription, SEO_DESCRIPTION),
    'seoDescription',
    `seoDescription must be ${SEO_DESCRIPTION.min} to ${SEO_DESCRIPTION.max} characters to publish`,
  );
  return problems;
}
