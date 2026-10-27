import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ValidationDetail, ValidationException } from '../../common/exceptions/validation.exception.js';
import { HeroStatus } from '../../generated/prisma/client.js';
import { RevalidationService } from '../../infrastructure/revalidation/revalidation.service.js';
import { MediaReferences } from '../media/media-references.js';
import { MediaPresenter } from '../media/media.presenter.js';
import type { MediaRef } from '../media/media.presenter.js';
import type { CreateHeroDto, CtaLinkDto, UpdateHeroDto } from './dto/hero.dto.js';
import { HeroData, HeroRepository, HeroRow } from './hero.repository.js';

export interface CtaLink {
  label: string;
  url: string;
}

export interface HeroResponse {
  id: string;
  title: string;
  status: HeroStatus;
  isDefault: false;
  heading: string | null;
  subheading: string | null;
  primaryCta: CtaLink | null;
  secondaryCta: CtaLink | null;
  image: MediaRef | null;
  createdAt: Date;
  updatedAt: Date;
}

const REVALIDATED_TAGS = ['hero'];

const toCta = (label: string | null, url: string | null): CtaLink | null => (label && url ? { label, url } : null);

@Injectable()
export class HeroService {
  constructor(
    private readonly repository: HeroRepository,
    private readonly revalidation: RevalidationService,
    private readonly media: MediaPresenter,
    private readonly mediaReferences: MediaReferences,
  ) {}

  async list(): Promise<HeroResponse[]> {
    return (await this.repository.findAll()).map((hero) => this.present(hero));
  }

  async get(id: string): Promise<HeroResponse> {
    return this.present(await this.findOrThrow(id));
  }

  async create(dto: CreateHeroDto): Promise<HeroResponse> {
    await this.mediaReferences.assertExist({ imageId: dto.imageId });
    return this.present(await this.repository.create({ ...this.toData(dto), title: dto.title }));
  }

  async update(id: string, dto: UpdateHeroDto): Promise<HeroResponse> {
    const current = await this.findOrThrow(id);
    await this.mediaReferences.assertExist({ imageId: dto.imageId });

    const updated = await this.repository.update(id, this.toData(dto));
    if (current.status === HeroStatus.PUBLISHED) {
      this.revalidation.revalidate(REVALIDATED_TAGS);
    }
    return this.present(updated);
  }

  async delete(id: string): Promise<void> {
    if ((await this.findOrThrow(id)).status === HeroStatus.PUBLISHED) {
      throw new ConflictException('Unpublish the hero before deleting it');
    }
    await this.repository.delete(id);
  }

  async publish(id: string): Promise<HeroResponse> {
    const hero = await this.findOrThrow(id);
    const problems = this.findPublishProblems(hero);
    if (problems.length > 0) {
      throw new ValidationException(problems);
    }

    const published = await this.repository.publishOnly(id);
    this.revalidation.revalidate(REVALIDATED_TAGS);
    return this.present(published);
  }

  async unpublish(id: string): Promise<HeroResponse> {
    const hero = await this.findOrThrow(id);
    if (hero.status !== HeroStatus.PUBLISHED) {
      throw new ConflictException('Only the published hero can be unpublished');
    }

    const unpublished = await this.repository.unpublish(id);
    this.revalidation.revalidate(REVALIDATED_TAGS);
    return this.present(unpublished);
  }

  private async findOrThrow(id: string): Promise<HeroRow> {
    const hero = await this.repository.findById(id);
    if (!hero) {
      throw new NotFoundException('Hero not found');
    }
    return hero;
  }

  private findPublishProblems(hero: HeroRow): ValidationDetail[] {
    const missing = (path: string, absent: boolean): ValidationDetail[] =>
      absent ? [{ path, message: `${path} is required to publish` }] : [];

    return [
      ...missing('heading', !hero.heading),
      ...missing('subheading', !hero.subheading),
      ...missing('primaryCta', !toCta(hero.primaryCtaLabel, hero.primaryCtaUrl)),
    ];
  }

  private toData(dto: UpdateHeroDto): HeroData {
    return {
      title: dto.title ?? undefined,
      heading: dto.heading,
      subheading: dto.subheading,
      ...this.ctaColumns('primary', dto.primaryCta),
      ...this.ctaColumns('secondary', dto.secondaryCta),
      imageId: dto.imageId,
    };
  }

  private ctaColumns(prefix: 'primary' | 'secondary', cta: CtaLinkDto | null | undefined): HeroData {
    if (cta === undefined) {
      return {};
    }
    return { [`${prefix}CtaLabel`]: cta?.label ?? null, [`${prefix}CtaUrl`]: cta?.url ?? null };
  }

  private present(hero: HeroRow): HeroResponse {
    return {
      id: hero.id,
      title: hero.title,
      status: hero.status,
      isDefault: false,
      heading: hero.heading,
      subheading: hero.subheading,
      primaryCta: toCta(hero.primaryCtaLabel, hero.primaryCtaUrl),
      secondaryCta: toCta(hero.secondaryCtaLabel, hero.secondaryCtaUrl),
      image: this.media.refOrNull(hero.image),
      createdAt: hero.createdAt,
      updatedAt: hero.updatedAt,
    };
  }
}
