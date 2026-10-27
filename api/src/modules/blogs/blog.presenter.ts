import { Injectable } from '@nestjs/common';
import type { Blog, BlogStatus, BlogTag, Category, Media, Tag } from '../../generated/prisma/client.js';
import { MediaPresenter } from '../media/media.presenter.js';
import type { MediaRef } from '../media/media.presenter.js';
import { AuthorResponse, AuthorRow, TaxonomyPresenter, TaxonomyResponse } from '../taxonomy/taxonomy.presenter.js';

export type BlogWithRelations = Blog & {
  category: Category | null;
  author: AuthorRow | null;
  coverImage: Media | null;
  ogImage: Media | null;
  tags: (BlogTag & { tag: Tag })[];
};

export type ContentFormat = 'html' | 'json';

export interface AdminBlogRow {
  id: string;
  title: string;
  slug: string;
  status: BlogStatus;
  category: TaxonomyResponse | null;
  author: AuthorResponse | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface AdminBlog extends AdminBlogRow {
  excerpt: string | null;
  contentHtml: string | null;
  contentJson: unknown;
  coverImage: MediaRef | null;
  tags: TaxonomyResponse[];
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: MediaRef | null;
  readingTimeMin: number;
  createdAt: Date;
}

export interface PublicBlogDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: MediaRef | null;
  category: TaxonomyResponse | null;
  author: AuthorResponse | null;
  readingTimeMin: number;
  publishedAt: Date | null;
  contentHtml?: string | null;
  contentJson?: unknown;
  tags: TaxonomyResponse[];
  seoTitle: string;
  seoDescription: string;
  ogImage: MediaRef | null;
  updatedAt: Date;
}

@Injectable()
export class BlogPresenter {
  constructor(
    private readonly media: MediaPresenter,
    private readonly taxonomy: TaxonomyPresenter,
  ) {}

  adminRow(blog: BlogWithRelations): AdminBlogRow {
    return {
      id: blog.id,
      title: blog.title,
      slug: blog.slug,
      status: blog.status,
      category: blog.category && this.taxonomy.taxonomy(blog.category),
      author: blog.author && this.taxonomy.author(blog.author),
      publishedAt: blog.publishedAt,
      updatedAt: blog.updatedAt,
    };
  }

  admin(blog: BlogWithRelations): AdminBlog {
    return {
      ...this.adminRow(blog),
      excerpt: blog.excerpt,
      contentHtml: blog.contentHtml,
      contentJson: blog.contentJson,
      coverImage: this.media.refOrNull(blog.coverImage),
      tags: blog.tags.map(({ tag }) => this.taxonomy.taxonomy(tag)),
      seoTitle: blog.seoTitle,
      seoDescription: blog.seoDescription,
      ogImage: this.media.refOrNull(blog.ogImage),
      readingTimeMin: blog.readingTimeMin,
      createdAt: blog.createdAt,
    };
  }

  publicDetail(blog: BlogWithRelations, format: ContentFormat): PublicBlogDetail {
    const content = format === 'json' ? { contentJson: blog.contentJson } : { contentHtml: blog.contentHtml };
    return {
      id: blog.id,
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt,
      coverImage: this.media.refOrNull(blog.coverImage),
      category: blog.category && this.taxonomy.taxonomy(blog.category),
      author: blog.author && this.taxonomy.author(blog.author),
      readingTimeMin: blog.readingTimeMin,
      publishedAt: blog.publishedAt,
      ...content,
      tags: blog.tags.map(({ tag }) => this.taxonomy.taxonomy(tag)),
      seoTitle: blog.seoTitle || blog.title,
      seoDescription: blog.seoDescription || blog.excerpt || '',
      ogImage: this.media.refOrNull(blog.ogImage ?? blog.coverImage),
      updatedAt: blog.updatedAt,
    };
  }
}
