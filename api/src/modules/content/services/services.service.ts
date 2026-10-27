import { ConflictException, Injectable } from '@nestjs/common';
import { allocateSlug } from '../../../common/slug/slug-allocator.js';
import { RevalidationService } from '../../../infrastructure/revalidation/revalidation.service.js';
import { MediaReferences } from '../../media/media-references.js';
import { MediaPresenter } from '../../media/media.presenter.js';
import type { MediaRef } from '../../media/media.presenter.js';
import { ContentService } from '../content.service.js';
import type { CreateServiceDto, UpdateServiceDto } from './dto/service.dto.js';
import { ServiceData, ServiceRow, ServicesRepository } from './services.repository.js';

export interface ServiceResponse {
  id: string;
  title: string;
  slug: string;
  icon: string | null;
  shortDescription: string | null;
  description: string | null;
  technologies: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: MediaRef | null;
  sortOrder: number;
  isPublished: boolean;
}

const FALLBACK_SLUG = 'service';
const LAST_PUBLISHED = 'At least one service must stay published';

@Injectable()
export class ServicesService extends ContentService<
  ServiceRow,
  ServiceResponse,
  CreateServiceDto,
  UpdateServiceDto,
  ServiceData
> {
  constructor(
    private readonly services: ServicesRepository,
    revalidation: RevalidationService,
    private readonly media: MediaPresenter,
    private readonly mediaReferences: MediaReferences,
  ) {
    super(services, revalidation, 'Service');
  }

  protected present(row: ServiceRow): ServiceResponse {
    const { ogImage, createdAt: _createdAt, updatedAt: _updatedAt, ogImageId: _ogImageId, ...fields } = row;
    return { ...fields, ogImage: this.media.refOrNull(ogImage) };
  }

  protected async toData(dto: CreateServiceDto | UpdateServiceDto, current?: ServiceRow): Promise<Partial<ServiceData>> {
    return {
      title: dto.title ?? undefined,
      slug: await this.resolveSlug(dto, current),
      icon: dto.icon,
      shortDescription: dto.shortDescription,
      description: dto.description,
      technologies: dto.technologies ?? undefined,
      seoTitle: dto.seoTitle,
      seoDescription: dto.seoDescription,
      ogImageId: dto.ogImageId,
      sortOrder: dto.sortOrder ?? undefined,
      isPublished: dto.isPublished ?? undefined,
    };
  }

  protected revalidationTags({ slug }: ServiceRow): string[] {
    return ['services', `service:${slug}`];
  }

  protected async validateCreate(dto: CreateServiceDto): Promise<void> {
    await this.mediaReferences.assertExist({ ogImageId: dto.ogImageId });
  }

  protected async validateUpdate(current: ServiceRow, dto: UpdateServiceDto): Promise<void> {
    await this.mediaReferences.assertExist({ ogImageId: dto.ogImageId });
    if (dto.isPublished === false) {
      await this.assertAnotherStaysPublished(current);
    }
  }

  protected async validateDelete(current: ServiceRow): Promise<void> {
    await this.assertAnotherStaysPublished(current);
  }

  private async assertAnotherStaysPublished(current: ServiceRow): Promise<void> {
    if (current.isPublished && (await this.services.countPublished(current.id)) === 0) {
      throw new ConflictException(LAST_PUBLISHED);
    }
  }

  private resolveSlug(dto: CreateServiceDto | UpdateServiceDto, current?: ServiceRow): Promise<string | undefined> {
    if (current && !dto.slug) {
      return Promise.resolve(undefined);
    }
    return allocateSlug({
      requested: dto.slug,
      source: dto.title ?? current?.title ?? '',
      fallback: FALLBACK_SLUG,
      isTaken: (slug) => this.services.slugExists(slug, current?.id),
    });
  }
}
