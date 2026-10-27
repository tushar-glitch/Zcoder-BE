import { Injectable } from '@nestjs/common';
import type { ValidationDetail } from '../../common/exceptions/validation.exception.js';
import { PageRequest, toSkipTake } from '../../common/pagination/paginated.js';
import type { SortDirection } from '../../common/pagination/sort.js';
import { BlogStatus, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type { BlogWithRelations } from './blog.presenter.js';

export interface BlogWriteData {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  contentJson?: Prisma.InputJsonValue;
  contentHtml?: string | null;
  readingTimeMin?: number;
  coverImageId?: string | null;
  ogImageId?: string | null;
  categoryId?: string | null;
  authorId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  publishedAt?: Date | null;
  status?: BlogStatus;
}

export type NewBlog = BlogWriteData & { title: string; slug: string };

export interface BlogChange {
  data: BlogWriteData;
  tagIds?: string[];
  slugHistory?: { add?: string; remove?: string };
}

export interface BlogFilters {
  status?: BlogStatus;
  categoryId?: string;
  q?: string;
}

export interface BlogReferences {
  categoryId?: string | null;
  authorId?: string | null;
  coverImageId?: string | null;
  ogImageId?: string | null;
  tagIds?: string[];
}

export type BlogOrderBy = Partial<Record<'updatedAt' | 'createdAt' | 'publishedAt' | 'title', SortDirection>>;

export const BLOG_INCLUDE = {
  category: true,
  author: { include: { avatar: true } },
  coverImage: true,
  ogImage: true,
  tags: { include: { tag: true }, orderBy: { tag: { name: 'asc' } } },
} satisfies Prisma.BlogInclude;

const tagLinks = (tagIds: string[]) => tagIds.map((tagId) => ({ tagId }));

@Injectable()
export class BlogsRepository {
  constructor(private readonly database: PrismaService) {}

  create(data: NewBlog, tagIds: string[]): Promise<BlogWithRelations> {
    return this.database.blog.create({ data: { ...data, tags: { create: tagLinks(tagIds) } }, include: BLOG_INCLUDE });
  }

  findById(id: string): Promise<BlogWithRelations | null> {
    return this.database.blog.findUnique({ where: { id }, include: BLOG_INCLUDE });
  }

  async findPage(
    { status, categoryId, q }: BlogFilters,
    orderBy: BlogOrderBy,
    page: PageRequest,
  ): Promise<{ items: BlogWithRelations[]; total: number }> {
    const where: Prisma.BlogWhereInput = {
      status,
      categoryId,
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { excerpt: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.database.$transaction([
      this.database.blog.findMany({ where, orderBy, include: BLOG_INCLUDE, ...toSkipTake(page) }),
      this.database.blog.count({ where }),
    ]);
    return { items, total };
  }

  update(id: string, { data, tagIds, slugHistory }: BlogChange): Promise<BlogWithRelations> {
    return this.database.$transaction(async (transaction) => {
      if (slugHistory?.remove) {
        await transaction.blogSlugHistory.deleteMany({ where: { blogId: id, slug: slugHistory.remove } });
      }
      if (slugHistory?.add) {
        await transaction.blogSlugHistory.create({ data: { blogId: id, slug: slugHistory.add } });
      }
      return transaction.blog.update({
        where: { id },
        data: { ...data, ...(tagIds && { tags: { deleteMany: {}, create: tagLinks(tagIds) } }) },
        include: BLOG_INCLUDE,
      });
    });
  }

  async delete(id: string): Promise<void> {
    await this.database.blog.delete({ where: { id } });
  }

  async slugTaken(slug: string, excludeBlogId?: string): Promise<boolean> {
    const [current, previous] = await Promise.all([
      this.database.blog.count({ where: { slug, id: { not: excludeBlogId } } }),
      this.database.blogSlugHistory.count({ where: { slug, blogId: { not: excludeBlogId } } }),
    ]);
    return current + previous > 0;
  }

  async findMissingReferences({ categoryId, authorId, coverImageId, ogImageId, tagIds }: BlogReferences): Promise<ValidationDetail[]> {
    const checks: [string, string, Promise<number>, number][] = [];
    const expectOne = (path: string, label: string, count: Promise<number>) => checks.push([path, label, count, 1]);

    if (categoryId) expectOne('categoryId', 'category', this.database.category.count({ where: { id: categoryId } }));
    if (authorId) expectOne('authorId', 'author', this.database.author.count({ where: { id: authorId } }));
    if (coverImageId) expectOne('coverImageId', 'media', this.database.media.count({ where: { id: coverImageId } }));
    if (ogImageId) expectOne('ogImageId', 'media', this.database.media.count({ where: { id: ogImageId } }));
    if (tagIds?.length) {
      checks.push(['tagIds', 'tag', this.database.tag.count({ where: { id: { in: tagIds } } }), tagIds.length]);
    }

    const counts = await Promise.all(checks.map(([, , count]) => count));
    return checks.flatMap(([path, label, , expected], index) =>
      counts[index] === expected ? [] : [{ path, message: `${path} does not match an existing ${label}` }],
    );
  }
}
