import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginated } from '../../common/pagination/paginated.js';
import { BlogPresenter, BlogSummary, ContentFormat, PublicBlogDetail } from '../blogs/blog.presenter.js';
import { TaxonomyPresenter, TaxonomyWithCountResponse } from '../taxonomy/taxonomy.presenter.js';
import type { PublicBlogListQueryDto } from './dto/public-query.dto.js';
import { PublicRepository } from './public.repository.js';

const RELATED_LIMIT = 3;

export interface BlogRedirect {
  redirectTo: string;
}

export type PublicBlogResponse = (PublicBlogDetail & { related: BlogSummary[] }) | BlogRedirect;

@Injectable()
export class PublicBlogsService {
  constructor(
    private readonly repository: PublicRepository,
    private readonly blogs: BlogPresenter,
    private readonly taxonomy: TaxonomyPresenter,
  ) {}

  async list({ category, tag, q, page, pageSize }: PublicBlogListQueryDto): Promise<Paginated<BlogSummary>> {
    const { items, total } = await this.repository.findPublishedBlogs({ category, tag, q }, { page, pageSize });
    return Paginated.of(items, total, { page, pageSize }).map((blog) => this.blogs.summary(blog));
  }

  async detail(slug: string, format: ContentFormat): Promise<PublicBlogResponse> {
    const blog = await this.repository.findPublishedBlog(slug);
    if (!blog) {
      return this.redirectOrThrow(slug);
    }

    const related = await this.repository.findRelatedBlogs(blog, RELATED_LIMIT);
    return { ...this.blogs.publicDetail(blog, format), related: related.map((post) => this.blogs.summary(post)) };
  }

  async categories(): Promise<TaxonomyWithCountResponse[]> {
    return (await this.repository.findCategoriesWithPosts()).map((row) => this.taxonomy.taxonomyWithCount(row));
  }

  async tags(): Promise<TaxonomyWithCountResponse[]> {
    return (await this.repository.findTagsWithPosts()).map((row) => this.taxonomy.taxonomyWithCount(row));
  }

  private async redirectOrThrow(slug: string): Promise<BlogRedirect> {
    const current = await this.repository.findRenamedBlogSlug(slug);
    if (!current) {
      throw new NotFoundException('Blog not found');
    }
    return { redirectTo: current };
  }
}
