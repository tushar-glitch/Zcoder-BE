import { Injectable } from '@nestjs/common';
import { Paginated } from '../../../common/pagination/paginated.js';
import type { PageRequest } from '../../../common/pagination/paginated.js';
import { parseSort } from '../../../common/pagination/sort.js';
import { allocateSlug } from '../../../common/slug/slug-allocator.js';
import { RevalidationService } from '../../../infrastructure/revalidation/revalidation.service.js';
import { MediaReferences } from '../../media/media-references.js';
import { MediaPresenter } from '../../media/media.presenter.js';
import type { MediaRef } from '../../media/media.presenter.js';
import { ContentService } from '../content.service.js';
import type { CreateProjectDto, UpdateProjectDto } from './dto/project.dto.js';
import { ProjectData, ProjectRow, ProjectsRepository } from './projects.repository.js';

export interface ProjectResponse {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  technologies: string[];
  coverImage: MediaRef | null;
  isFeatured: boolean;
  description: string | null;
  gallery: { image: MediaRef; sortOrder: number }[];
  demoUrl: string | null;
  sourceUrl: string | null;
  clientName: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: MediaRef | null;
  isPublished: boolean;
  sortOrder: number;
  publishedAt: Date | null;
}

const FALLBACK_SLUG = 'project';
const SORTABLE_FIELDS = ['sortOrder', 'createdAt', 'title', 'publishedAt'] as const;

@Injectable()
export class ProjectsService extends ContentService<
  ProjectRow,
  ProjectResponse,
  CreateProjectDto,
  UpdateProjectDto,
  ProjectData
> {
  constructor(
    private readonly projects: ProjectsRepository,
    revalidation: RevalidationService,
    private readonly media: MediaPresenter,
    private readonly mediaReferences: MediaReferences,
  ) {
    super(projects, revalidation, 'Project');
  }

  async search(
    query: { published?: boolean; q?: string; sort?: string },
    page: PageRequest,
  ): Promise<Paginated<ProjectResponse>> {
    const orderBy = parseSort(query.sort, SORTABLE_FIELDS, { field: 'sortOrder', direction: 'asc' });
    const { items, total } = await this.projects.findPage(query, orderBy, page);
    return Paginated.of(items, total, page).map((row) => this.present(row));
  }

  protected present(row: ProjectRow): ProjectResponse {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      technologies: row.technologies,
      coverImage: this.media.refOrNull(row.coverImage),
      isFeatured: row.isFeatured,
      description: row.description,
      gallery: row.gallery.map(({ media, sortOrder }) => ({ image: this.media.ref(media), sortOrder })),
      demoUrl: row.demoUrl,
      sourceUrl: row.sourceUrl,
      clientName: row.clientName,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      ogImage: this.media.refOrNull(row.ogImage),
      isPublished: row.isPublished,
      sortOrder: row.sortOrder,
      publishedAt: row.publishedAt,
    };
  }

  protected async toData(dto: CreateProjectDto | UpdateProjectDto, current?: ProjectRow): Promise<Partial<ProjectData>> {
    return {
      title: dto.title ?? undefined,
      slug: await this.resolveSlug(dto, current),
      summary: dto.summary,
      description: dto.description,
      technologies: dto.technologies ?? undefined,
      coverImageId: dto.coverImageId,
      galleryImageIds: dto.galleryImageIds ?? undefined,
      demoUrl: dto.demoUrl,
      sourceUrl: dto.sourceUrl,
      clientName: dto.clientName,
      seoTitle: dto.seoTitle,
      seoDescription: dto.seoDescription,
      ogImageId: dto.ogImageId,
      isFeatured: dto.isFeatured ?? undefined,
      isPublished: dto.isPublished ?? undefined,
      sortOrder: dto.sortOrder ?? undefined,
      publishedAt: dto.isPublished && !current?.publishedAt ? new Date() : undefined,
    };
  }

  protected revalidationTags({ slug }: ProjectRow): string[] {
    return ['projects', `project:${slug}`];
  }

  protected validateCreate(dto: CreateProjectDto): Promise<void> {
    return this.assertMediaExist(dto);
  }

  protected validateUpdate(_current: ProjectRow, dto: UpdateProjectDto): Promise<void> {
    return this.assertMediaExist(dto);
  }

  private assertMediaExist({ coverImageId, ogImageId, galleryImageIds }: UpdateProjectDto): Promise<void> {
    return this.mediaReferences.assertExist({ coverImageId, ogImageId, galleryImageIds });
  }

  private resolveSlug(dto: CreateProjectDto | UpdateProjectDto, current?: ProjectRow): Promise<string | undefined> {
    if (current && !dto.slug) {
      return Promise.resolve(undefined);
    }
    return allocateSlug({
      requested: dto.slug,
      source: dto.title ?? current?.title ?? '',
      fallback: FALLBACK_SLUG,
      isTaken: (slug) => this.projects.slugExists(slug, current?.id),
    });
  }
}
