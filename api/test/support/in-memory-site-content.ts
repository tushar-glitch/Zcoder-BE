import { randomUUID } from 'node:crypto';
import type { PageRequest } from '../../src/common/pagination/paginated.js';
import { Faq, Hero, HeroStatus, Project, Service, Testimonial } from '../../src/generated/prisma/client.js';
import type { FaqData } from '../../src/modules/content/faqs/faqs.repository.js';
import type { ProjectData, ProjectFilters, ProjectOrderBy, ProjectRow } from '../../src/modules/content/projects/projects.repository.js';
import type { ServiceData, ServiceRow } from '../../src/modules/content/services/services.repository.js';
import type { TestimonialData, TestimonialRow } from '../../src/modules/content/testimonials/testimonials.repository.js';
import type { HeroData, HeroRow } from '../../src/modules/hero/hero.repository.js';
import type { InMemoryMediaRepository } from './in-memory-content.js';

const stamp = () => ({ createdAt: new Date(), updatedAt: new Date() });

const defined = <T extends object>(data: T): T =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;

function assignDefined(target: object, data: object): void {
  Object.entries(data).forEach(([key, value]) => value !== undefined && Object.assign(target, { [key]: value }));
}

abstract class InMemoryContentRepository<TBase extends { id: string; sortOrder: number; createdAt: Date }, TRow extends { id: string }, TData extends { sortOrder: number }> {
  readonly rows = new Map<string, TBase>();

  protected abstract build(data: TData): TBase;
  protected abstract hydrate(base: TBase): TRow;

  async findAll(): Promise<TRow[]> {
    return [...this.rows.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
      .map((base) => this.hydrate(base));
  }

  async findById(id: string): Promise<TRow | null> {
    const base = this.rows.get(id);
    return base ? this.hydrate(base) : null;
  }

  async create(data: TData): Promise<TRow> {
    const base = this.build(data);
    this.rows.set(base.id, base);
    return this.hydrate(base);
  }

  async update(id: string, data: Partial<TData>): Promise<TRow> {
    const base = this.rows.get(id)!;
    assignDefined(base, data);
    Object.assign(base, { updatedAt: new Date() });
    return this.hydrate(base);
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async nextSortOrder(): Promise<number> {
    return Math.max(-1, ...[...this.rows.values()].map((row) => row.sortOrder)) + 1;
  }
}

export class InMemoryServicesRepository extends InMemoryContentRepository<Service, ServiceRow, ServiceData> {
  constructor(private readonly media: InMemoryMediaRepository) {
    super();
  }

  protected build(data: ServiceData): Service {
    return {
      id: randomUUID(),
      icon: null,
      shortDescription: null,
      description: null,
      technologies: [],
      seoTitle: null,
      seoDescription: null,
      ogImageId: null,
      isPublished: false,
      ...stamp(),
      ...defined(data),
    };
  }

  protected hydrate(base: Service): ServiceRow {
    return { ...base, ogImage: (base.ogImageId && this.media.items.get(base.ogImageId)) || null };
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return [...this.rows.values()].some((row) => row.slug === slug && row.id !== excludeId);
  }

  async countPublished(excludeId: string): Promise<number> {
    return [...this.rows.values()].filter((row) => row.isPublished && row.id !== excludeId).length;
  }
}

export class InMemoryProjectsRepository extends InMemoryContentRepository<Project, ProjectRow, ProjectData> {
  private readonly galleries = new Map<string, string[]>();

  constructor(private readonly media: InMemoryMediaRepository) {
    super();
  }

  protected build({ galleryImageIds, ...data }: ProjectData): Project {
    const project: Project = {
      id: randomUUID(),
      summary: null,
      description: null,
      technologies: [],
      coverImageId: null,
      demoUrl: null,
      sourceUrl: null,
      clientName: null,
      seoTitle: null,
      seoDescription: null,
      ogImageId: null,
      isFeatured: false,
      isPublished: false,
      publishedAt: null,
      ...stamp(),
      ...defined(data),
    };
    this.galleries.set(project.id, galleryImageIds ?? []);
    return project;
  }

  protected hydrate(base: Project): ProjectRow {
    const { items } = this.media;
    return {
      ...base,
      coverImage: (base.coverImageId && items.get(base.coverImageId)) || null,
      ogImage: (base.ogImageId && items.get(base.ogImageId)) || null,
      gallery: (this.galleries.get(base.id) ?? []).map((mediaId, sortOrder) => ({
        projectId: base.id,
        mediaId,
        sortOrder,
        media: items.get(mediaId)!,
      })),
    };
  }

  async update(id: string, { galleryImageIds, ...data }: Partial<ProjectData>): Promise<ProjectRow> {
    if (galleryImageIds) {
      this.galleries.set(id, galleryImageIds);
    }
    return super.update(id, data);
  }

  async findPage({ published, q }: ProjectFilters, orderBy: ProjectOrderBy, { page, pageSize }: PageRequest) {
    const needle = q?.toLowerCase();
    const [[field, direction]] = Object.entries(orderBy) as [[keyof ProjectOrderBy, 'asc' | 'desc']];
    const matching = [...this.rows.values()]
      .filter((row) => published === undefined || row.isPublished === published)
      .filter((row) => !needle || `${row.title} ${row.slug} ${row.summary ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => ((a[field] ?? 0) > (b[field] ?? 0) ? 1 : -1) * (direction === 'asc' ? 1 : -1));
    return { items: matching.slice((page - 1) * pageSize, page * pageSize).map((row) => this.hydrate(row)), total: matching.length };
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return [...this.rows.values()].some((row) => row.slug === slug && row.id !== excludeId);
  }
}

export class InMemoryTestimonialsRepository extends InMemoryContentRepository<Testimonial, TestimonialRow, TestimonialData> {
  constructor(private readonly media: InMemoryMediaRepository) {
    super();
  }

  protected build(data: TestimonialData): Testimonial {
    return {
      id: randomUUID(),
      clientRole: null,
      company: null,
      avatarId: null,
      rating: null,
      clientApproved: false,
      isPublished: false,
      ...stamp(),
      ...defined(data),
    };
  }

  protected hydrate(base: Testimonial): TestimonialRow {
    return { ...base, avatar: (base.avatarId && this.media.items.get(base.avatarId)) || null };
  }
}

export class InMemoryFaqsRepository extends InMemoryContentRepository<Faq, Faq, FaqData> {
  protected build(data: FaqData): Faq {
    return { id: randomUUID(), group: null, showOnHome: false, isPublished: false, ...stamp(), ...defined(data) };
  }

  protected hydrate(base: Faq): Faq {
    return { ...base };
  }

  async countShownOnHome(excludeId?: string): Promise<number> {
    return [...this.rows.values()].filter((row) => row.showOnHome && row.id !== excludeId).length;
  }
}

export class InMemoryHeroRepository {
  readonly rows = new Map<string, Hero>();

  constructor(private readonly media: InMemoryMediaRepository) {}

  private hydrate(base: Hero): HeroRow {
    return { ...base, image: (base.imageId && this.media.items.get(base.imageId)) || null };
  }

  async findAll(): Promise<HeroRow[]> {
    return [...this.rows.values()]
      .sort((a, b) => Number(b.status === HeroStatus.PUBLISHED) - Number(a.status === HeroStatus.PUBLISHED) || b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((row) => this.hydrate(row));
  }

  async findById(id: string): Promise<HeroRow | null> {
    const base = this.rows.get(id);
    return base ? this.hydrate(base) : null;
  }

  async create(data: HeroData & { title: string }): Promise<HeroRow> {
    const base: Hero = {
      id: randomUUID(),
      heading: null,
      subheading: null,
      primaryCtaLabel: null,
      primaryCtaUrl: null,
      secondaryCtaLabel: null,
      secondaryCtaUrl: null,
      imageId: null,
      status: HeroStatus.DRAFT,
      ...stamp(),
    } as Hero;
    assignDefined(base, data);
    this.rows.set(base.id, base);
    return this.hydrate(base);
  }

  async update(id: string, data: HeroData): Promise<HeroRow> {
    const base = this.rows.get(id)!;
    assignDefined(base, data);
    base.updatedAt = new Date();
    return this.hydrate(base);
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async publishOnly(id: string): Promise<HeroRow> {
    this.rows.forEach((hero) => {
      hero.status = hero.id === id ? HeroStatus.PUBLISHED : HeroStatus.DRAFT;
    });
    return this.hydrate(this.rows.get(id)!);
  }

  async unpublish(id: string): Promise<HeroRow> {
    this.rows.get(id)!.status = HeroStatus.DRAFT;
    return this.hydrate(this.rows.get(id)!);
  }
}
