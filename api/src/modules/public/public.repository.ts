import { Injectable } from '@nestjs/common';
import { PageRequest, toSkipTake } from '../../common/pagination/paginated.js';
import { BlogStatus, Faq, HeroStatus, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type { BlogWithRelations } from '../blogs/blog.presenter.js';
import { BLOG_INCLUDE } from '../blogs/blogs.repository.js';
import { PROJECT_INCLUDE, ProjectRow } from '../content/projects/projects.repository.js';
import type { ServiceRow } from '../content/services/services.repository.js';
import type { TestimonialRow } from '../content/testimonials/testimonials.repository.js';
import type { HeroRow } from '../hero/hero.repository.js';
import type { TaxonomyRowWithCount } from '../taxonomy/taxonomy.presenter.js';

export interface ProjectQuery {
  featured?: boolean;
  technology?: string;
}

export interface BlogQuery {
  category?: string;
  tag?: string;
  q?: string;
}

export interface SitemapEntry {
  slug: string;
  lastModified: Date;
}

export interface SitemapEntries {
  blogs: SitemapEntry[];
  projects: SitemapEntry[];
  categories: SitemapEntry[];
  tags: SitemapEntry[];
}

const PUBLISHED_ORDER = [{ sortOrder: 'asc' }, { createdAt: 'asc' }] satisfies Prisma.ServiceOrderByWithRelationInput[];
const PUBLISHED_BLOG = { status: BlogStatus.PUBLISHED } as const;
const NEWEST_FIRST = [{ publishedAt: 'desc' }, { id: 'asc' }] satisfies Prisma.BlogOrderByWithRelationInput[];

const toEntry = ({ slug, updatedAt }: { slug: string; updatedAt: Date }): SitemapEntry => ({ slug, lastModified: updatedAt });

@Injectable()
export class PublicRepository {
  constructor(private readonly database: PrismaService) {}

  findPublishedHero(): Promise<HeroRow | null> {
    return this.database.hero.findFirst({ where: { status: HeroStatus.PUBLISHED }, include: { image: true } });
  }

  findPublishedServices(): Promise<ServiceRow[]> {
    return this.database.service.findMany({ where: { isPublished: true }, include: { ogImage: true }, orderBy: PUBLISHED_ORDER });
  }

  findPublishedService(slug: string): Promise<ServiceRow | null> {
    return this.database.service.findFirst({ where: { slug, isPublished: true }, include: { ogImage: true } });
  }

  async findPublishedProjects({ featured, technology }: ProjectQuery, page: PageRequest): Promise<{ items: ProjectRow[]; total: number }> {
    const where: Prisma.ProjectWhereInput = {
      isPublished: true,
      isFeatured: featured,
      ...(technology && { technologies: { has: technology } }),
    };
    const [items, total] = await this.database.$transaction([
      this.database.project.findMany({ where, include: PROJECT_INCLUDE, orderBy: PUBLISHED_ORDER, ...toSkipTake(page) }),
      this.database.project.count({ where }),
    ]);
    return { items, total };
  }

  findPublishedProject(slug: string): Promise<ProjectRow | null> {
    return this.database.project.findFirst({ where: { slug, isPublished: true }, include: PROJECT_INCLUDE });
  }

  findPublishedTestimonials(limit: number): Promise<TestimonialRow[]> {
    return this.database.testimonial.findMany({
      where: { isPublished: true },
      include: { avatar: true },
      orderBy: PUBLISHED_ORDER,
      take: limit,
    });
  }

  findPublishedFaqs(homeOnly: boolean): Promise<Faq[]> {
    return this.database.faq.findMany({
      where: { isPublished: true, ...(homeOnly && { showOnHome: true }) },
      orderBy: PUBLISHED_ORDER,
    });
  }

  async findPublishedBlogs({ category, tag, q }: BlogQuery, page: PageRequest): Promise<{ items: BlogWithRelations[]; total: number }> {
    const where: Prisma.BlogWhereInput = {
      ...PUBLISHED_BLOG,
      ...(category && { category: { slug: category } }),
      ...(tag && { tags: { some: { tag: { slug: tag } } } }),
      ...(q && {
        OR: [{ title: { contains: q, mode: 'insensitive' } }, { excerpt: { contains: q, mode: 'insensitive' } }],
      }),
    };
    const [items, total] = await this.database.$transaction([
      this.database.blog.findMany({ where, include: BLOG_INCLUDE, orderBy: NEWEST_FIRST, ...toSkipTake(page) }),
      this.database.blog.count({ where }),
    ]);
    return { items, total };
  }

  findPublishedBlog(slug: string): Promise<BlogWithRelations | null> {
    return this.database.blog.findFirst({ where: { slug, ...PUBLISHED_BLOG }, include: BLOG_INCLUDE });
  }

  async findRenamedBlogSlug(oldSlug: string): Promise<string | null> {
    const entry = await this.database.blogSlugHistory.findUnique({
      where: { slug: oldSlug },
      select: { blog: { select: { slug: true, status: true } } },
    });
    return entry?.blog.status === BlogStatus.PUBLISHED ? entry.blog.slug : null;
  }

  findRelatedBlogs(blog: BlogWithRelations, limit: number): Promise<BlogWithRelations[]> {
    const related: Prisma.BlogWhereInput[] = [
      ...(blog.categoryId ? [{ categoryId: blog.categoryId }] : []),
      ...(blog.tags.length > 0 ? [{ tags: { some: { tagId: { in: blog.tags.map(({ tagId }) => tagId) } } } }] : []),
    ];
    if (related.length === 0) {
      return Promise.resolve([]);
    }
    return this.database.blog.findMany({
      where: { ...PUBLISHED_BLOG, id: { not: blog.id }, OR: related },
      include: BLOG_INCLUDE,
      orderBy: NEWEST_FIRST,
      take: limit,
    });
  }

  findCategoriesWithPosts(): Promise<TaxonomyRowWithCount[]> {
    return this.database.category.findMany({
      where: { blogs: { some: PUBLISHED_BLOG } },
      include: { _count: { select: { blogs: { where: PUBLISHED_BLOG } } } },
      orderBy: { name: 'asc' },
    });
  }

  findTagsWithPosts(): Promise<TaxonomyRowWithCount[]> {
    return this.database.tag.findMany({
      where: { blogs: { some: { blog: PUBLISHED_BLOG } } },
      include: { _count: { select: { blogs: { where: { blog: PUBLISHED_BLOG } } } } },
      orderBy: { name: 'asc' },
    });
  }

  async findSitemapEntries(): Promise<SitemapEntries> {
    const select = { slug: true, updatedAt: true } as const;
    const [blogs, projects, categories, tags] = await Promise.all([
      this.database.blog.findMany({ where: PUBLISHED_BLOG, select, orderBy: NEWEST_FIRST }),
      this.database.project.findMany({ where: { isPublished: true }, select, orderBy: PUBLISHED_ORDER }),
      this.database.category.findMany({ where: { blogs: { some: PUBLISHED_BLOG } }, select, orderBy: { slug: 'asc' } }),
      this.database.tag.findMany({ where: { blogs: { some: { blog: PUBLISHED_BLOG } } }, select, orderBy: { slug: 'asc' } }),
    ]);
    return { blogs: blogs.map(toEntry), projects: projects.map(toEntry), categories: categories.map(toEntry), tags: tags.map(toEntry) };
  }
}
