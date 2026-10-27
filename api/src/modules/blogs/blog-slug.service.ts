import { ConflictException, Injectable } from '@nestjs/common';
import { SLUG_PATTERN, slugify, uniqueSlug } from '../../common/slug/slug.js';
import { BlogsRepository } from './blogs.repository.js';

const FALLBACK_SLUG = 'untitled';

export interface SlugChange {
  slug?: string;
  slugHistory?: { add?: string; remove?: string };
}

export interface SlugAvailability {
  available: boolean;
  suggestion: string | null;
}

@Injectable()
export class BlogSlugService {
  constructor(private readonly repository: BlogsRepository) {}

  async availability(slug: string, excludeBlogId?: string): Promise<SlugAvailability> {
    const free = SLUG_PATTERN.test(slug) && !(await this.repository.slugTaken(slug, excludeBlogId));
    if (free) {
      return { available: true, suggestion: null };
    }
    return { available: false, suggestion: await this.suggest(slug, excludeBlogId) };
  }

  async forNewBlog(title: string, requested?: string): Promise<string> {
    if (requested) {
      return this.requireFree(requested);
    }
    return this.suggest(title);
  }

  async forExistingBlog(blog: { id: string; slug: string; publishedAt: Date | null }, requested?: string): Promise<SlugChange> {
    if (!requested || requested === blog.slug) {
      return {};
    }

    await this.requireFree(requested, blog.id);
    return {
      slug: requested,
      slugHistory: { add: blog.publishedAt ? blog.slug : undefined, remove: requested },
    };
  }

  private async requireFree(slug: string, excludeBlogId?: string): Promise<string> {
    if (await this.repository.slugTaken(slug, excludeBlogId)) {
      throw new ConflictException('Slug is already in use');
    }
    return slug;
  }

  private suggest(text: string, excludeBlogId?: string): Promise<string> {
    return uniqueSlug(slugify(text) || FALLBACK_SLUG, (candidate) => this.repository.slugTaken(candidate, excludeBlogId));
  }
}
