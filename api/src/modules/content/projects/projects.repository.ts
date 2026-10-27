import { Injectable } from '@nestjs/common';
import { PageRequest, toSkipTake } from '../../../common/pagination/paginated.js';
import type { SortDirection } from '../../../common/pagination/sort.js';
import { Media, Prisma, Project, ProjectImage } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { ContentRepository } from '../content.repository.js';

export type ProjectRow = Project & {
  coverImage: Media | null;
  ogImage: Media | null;
  gallery: (ProjectImage & { media: Media })[];
};

export interface ProjectData {
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  technologies: string[];
  coverImageId: string | null;
  galleryImageIds: string[];
  demoUrl: string | null;
  sourceUrl: string | null;
  clientName: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageId: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: number;
  publishedAt: Date | null;
}

export interface ProjectFilters {
  published?: boolean;
  q?: string;
}

export type ProjectOrderBy = Partial<Record<'sortOrder' | 'createdAt' | 'title' | 'publishedAt', SortDirection>>;

const INCLUDE = {
  coverImage: true,
  ogImage: true,
  gallery: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProjectInclude;

const galleryLinks = (mediaIds: string[]) => mediaIds.map((mediaId, sortOrder) => ({ mediaId, sortOrder }));

@Injectable()
export class ProjectsRepository implements ContentRepository<ProjectRow, ProjectData> {
  constructor(private readonly database: PrismaService) {}

  findAll(): Promise<ProjectRow[]> {
    return this.database.project.findMany({ include: INCLUDE, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  findById(id: string): Promise<ProjectRow | null> {
    return this.database.project.findUnique({ where: { id }, include: INCLUDE });
  }

  async findPage(
    { published, q }: ProjectFilters,
    orderBy: ProjectOrderBy,
    page: PageRequest,
  ): Promise<{ items: ProjectRow[]; total: number }> {
    const where: Prisma.ProjectWhereInput = {
      isPublished: published,
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { summary: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.database.$transaction([
      this.database.project.findMany({ where, orderBy, include: INCLUDE, ...toSkipTake(page) }),
      this.database.project.count({ where }),
    ]);
    return { items, total };
  }

  create({ galleryImageIds, ...data }: ProjectData): Promise<ProjectRow> {
    return this.database.project.create({
      data: { ...data, gallery: { create: galleryLinks(galleryImageIds) } },
      include: INCLUDE,
    });
  }

  update(id: string, { galleryImageIds, ...data }: Partial<ProjectData>): Promise<ProjectRow> {
    return this.database.project.update({
      where: { id },
      data: { ...data, ...(galleryImageIds && { gallery: { deleteMany: {}, create: galleryLinks(galleryImageIds) } }) },
      include: INCLUDE,
    });
  }

  async delete(id: string): Promise<void> {
    await this.database.project.delete({ where: { id } });
  }

  async nextSortOrder(): Promise<number> {
    const { _max } = await this.database.project.aggregate({ _max: { sortOrder: true } });
    return (_max.sortOrder ?? -1) + 1;
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return (await this.database.project.count({ where: { slug, id: { not: excludeId } } })) > 0;
  }
}
