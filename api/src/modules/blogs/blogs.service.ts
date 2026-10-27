import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { Paginated } from '../../common/pagination/paginated.js';
import type { PageRequest } from '../../common/pagination/paginated.js';
import { parseSort } from '../../common/pagination/sort.js';
import { BlogStatus, Prisma } from '../../generated/prisma/client.js';
import { isUniqueViolation } from '../../infrastructure/database/prisma-errors.js';
import { RevalidationService } from '../../infrastructure/revalidation/revalidation.service.js';
import { assertCanDelete, assertCanPublish, assertCanUnpublish } from './blog-lifecycle.js';
import { findPublishProblems } from './blog-publish-checklist.js';
import { BlogSlugService, SlugAvailability } from './blog-slug.service.js';
import { AdminBlog, AdminBlogRow, BlogPresenter, BlogWithRelations, ContentFormat, PublicBlogDetail } from './blog.presenter.js';
import { BlogWriteData, BlogsRepository } from './blogs.repository.js';
import { ContentRenderer } from './content/content-renderer.js';
import type { CreateBlogDto, UpdateBlogDto } from './dto/blog.dto.js';

const SORTABLE_FIELDS = ['updatedAt', 'createdAt', 'publishedAt', 'title'] as const;

type ContentFields = Pick<BlogWriteData, 'contentJson' | 'contentHtml' | 'readingTimeMin'>;

@Injectable()
export class BlogsService {
  constructor(
    private readonly repository: BlogsRepository,
    private readonly presenter: BlogPresenter,
    private readonly slugs: BlogSlugService,
    private readonly renderer: ContentRenderer,
    private readonly revalidation: RevalidationService,
  ) {}

  async list(
    query: { status?: BlogStatus; categoryId?: string; q?: string; sort?: string },
    page: PageRequest,
  ): Promise<Paginated<AdminBlogRow>> {
    const orderBy = parseSort(query.sort, SORTABLE_FIELDS, { field: 'updatedAt', direction: 'desc' });
    const { items, total } = await this.repository.findPage(query, orderBy, page);
    return Paginated.of(items, total, page).map((blog) => this.presenter.adminRow(blog));
  }

  async get(id: string): Promise<AdminBlog> {
    return this.presenter.admin(await this.findOrThrow(id));
  }

  async preview(id: string, format: ContentFormat): Promise<PublicBlogDetail> {
    return this.presenter.publicDetail(await this.findOrThrow(id), format);
  }

  slugAvailability(slug: string, excludeId?: string): Promise<SlugAvailability> {
    return this.slugs.availability(slug, excludeId);
  }

  async create(dto: CreateBlogDto): Promise<AdminBlog> {
    await this.assertReferencesExist(dto);
    const slug = await this.slugs.forNewBlog(dto.title, dto.slug);
    const data = { ...this.writeData(dto, this.renderContent(dto.contentJson)), title: dto.title, slug };

    const blog = await this.guardSlug(() => this.repository.create(data, dto.tagIds ?? []));
    return this.presenter.admin(blog);
  }

  async update(id: string, dto: UpdateBlogDto): Promise<AdminBlog> {
    const blog = await this.findOrThrow(id);
    await this.assertReferencesExist(dto);
    const content = this.renderContent(dto.contentJson);
    const slugChange = await this.slugs.forExistingBlog(blog, dto.slug);

    if (blog.status === BlogStatus.PUBLISHED) {
      this.assertStillPublishable(blog, dto, content);
    }

    const updated = await this.guardSlug(() =>
      this.repository.update(id, {
        data: { ...this.writeData(dto, content), slug: slugChange.slug },
        tagIds: dto.tagIds,
        slugHistory: slugChange.slugHistory,
      }),
    );

    if (updated.status === BlogStatus.PUBLISHED) {
      this.revalidatePublished(updated.slug, blog.slug);
    }
    return this.presenter.admin(updated);
  }

  async publish(id: string): Promise<AdminBlog> {
    const blog = await this.findOrThrow(id);
    assertCanPublish(blog.status);

    const problems = findPublishProblems(blog);
    if (problems.length > 0) {
      throw new ValidationException(problems);
    }

    const published = await this.repository.update(id, {
      data: { status: BlogStatus.PUBLISHED, publishedAt: blog.publishedAt ?? new Date() },
    });
    this.revalidatePublished(published.slug);
    return this.presenter.admin(published);
  }

  async unpublish(id: string): Promise<AdminBlog> {
    const blog = await this.findOrThrow(id);
    assertCanUnpublish(blog.status);

    const unpublished = await this.repository.update(id, { data: { status: BlogStatus.DRAFT } });
    this.revalidatePublished(unpublished.slug);
    return this.presenter.admin(unpublished);
  }

  async delete(id: string): Promise<void> {
    assertCanDelete((await this.findOrThrow(id)).status);
    await this.repository.delete(id);
  }

  private async findOrThrow(id: string): Promise<BlogWithRelations> {
    const blog = await this.repository.findById(id);
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    return blog;
  }

  private renderContent(contentJson: Record<string, unknown> | undefined): ContentFields {
    if (contentJson === undefined) {
      return {};
    }
    const { html, readingTimeMin } = this.renderer.render(contentJson);
    return { contentJson: contentJson as Prisma.InputJsonObject, contentHtml: html, readingTimeMin };
  }

  private writeData(dto: UpdateBlogDto, content: ContentFields): BlogWriteData {
    return {
      title: dto.title,
      excerpt: dto.excerpt,
      coverImageId: dto.coverImageId,
      ogImageId: dto.ogImageId,
      categoryId: dto.categoryId,
      authorId: dto.authorId,
      seoTitle: dto.seoTitle,
      seoDescription: dto.seoDescription,
      publishedAt: dto.publishedAt,
      ...content,
    };
  }

  private async assertReferencesExist(dto: UpdateBlogDto): Promise<void> {
    const missing = await this.repository.findMissingReferences(dto);
    if (missing.length > 0) {
      throw new ValidationException(missing);
    }
  }

  private assertStillPublishable(blog: BlogWithRelations, dto: UpdateBlogDto, content: ContentFields): void {
    const problems = findPublishProblems({
      title: dto.title ?? blog.title,
      excerpt: dto.excerpt ?? blog.excerpt,
      readingTimeMin: content.readingTimeMin ?? blog.readingTimeMin,
      categoryId: dto.categoryId ?? blog.categoryId,
      authorId: dto.authorId ?? blog.authorId,
      coverImageId: dto.coverImageId === undefined ? blog.coverImageId : dto.coverImageId,
      seoDescription: dto.seoDescription ?? blog.seoDescription,
    });
    if (problems.length > 0) {
      throw new ValidationException(problems);
    }
  }

  private async guardSlug<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Slug is already in use');
      }
      throw error;
    }
  }

  private revalidatePublished(...slugs: string[]): void {
    this.revalidation.revalidate(['blogs', ...new Set(slugs.map((slug) => `blog:${slug}`))]);
  }
}
