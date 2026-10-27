import { ConflictException, NotFoundException } from '@nestjs/common';
import { slugify, uniqueSlug } from '../../common/slug/slug.js';
import { isForeignKeyViolation, isUniqueViolation } from '../../infrastructure/database/prisma-errors.js';
import { RevalidationService } from '../../infrastructure/revalidation/revalidation.service.js';
import type { CreateTaxonomyDto, UpdateTaxonomyDto } from './dto/taxonomy.dto.js';
import { TaxonomyPresenter, TaxonomyRowWithCount, TaxonomyWithCountResponse } from './taxonomy.presenter.js';
import { TaxonomyRepository } from './taxonomy.repository.js';

const FALLBACK_SLUG = 'untitled';
const REVALIDATED_TAGS = ['blogs'];

export abstract class TaxonomyService {
  protected constructor(
    private readonly repository: TaxonomyRepository,
    private readonly presenter: TaxonomyPresenter,
    private readonly revalidation: RevalidationService,
    private readonly label: string,
  ) {}

  async list(): Promise<TaxonomyWithCountResponse[]> {
    return (await this.repository.findAll()).map((row) => this.presenter.taxonomyWithCount(row));
  }

  async create(dto: CreateTaxonomyDto): Promise<TaxonomyWithCountResponse> {
    await this.assertNameFree(dto.name);
    const slug = dto.slug ? await this.assertSlugFree(dto.slug) : await this.generateSlug(dto.name);

    const created = await this.guardUnique(() =>
      this.repository.create({ name: dto.name, slug, description: dto.description ?? null }),
    );
    return this.published(created);
  }

  async update(id: string, dto: UpdateTaxonomyDto): Promise<TaxonomyWithCountResponse> {
    await this.findOrThrow(id);
    if (dto.name) {
      await this.assertNameFree(dto.name, id);
    }
    if (dto.slug) {
      await this.assertSlugFree(dto.slug, id);
    }

    const updated = await this.guardUnique(() =>
      this.repository.update(id, { name: dto.name ?? undefined, slug: dto.slug ?? undefined, description: dto.description }),
    );
    return this.published(updated);
  }

  async delete(id: string): Promise<void> {
    await this.findOrThrow(id);

    try {
      await this.repository.delete(id);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(`${this.label} is used by blog posts`);
      }
      throw error;
    }
    this.revalidation.revalidate(REVALIDATED_TAGS);
  }

  private async findOrThrow(id: string): Promise<TaxonomyRowWithCount> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException(`${this.label} not found`);
    }
    return row;
  }

  private async assertNameFree(name: string, excludeId?: string): Promise<void> {
    if (await this.repository.nameExists(name, excludeId)) {
      throw new ConflictException(`${this.label} name already exists`);
    }
  }

  private async assertSlugFree(slug: string, excludeId?: string): Promise<string> {
    if (await this.repository.slugExists(slug, excludeId)) {
      throw new ConflictException(`${this.label} slug already exists`);
    }
    return slug;
  }

  private generateSlug(name: string): Promise<string> {
    return uniqueSlug(slugify(name) || FALLBACK_SLUG, (candidate) => this.repository.slugExists(candidate));
  }

  private async guardUnique<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`${this.label} name or slug already exists`);
      }
      throw error;
    }
  }

  private published(row: TaxonomyRowWithCount): TaxonomyWithCountResponse {
    this.revalidation.revalidate(REVALIDATED_TAGS);
    return this.presenter.taxonomyWithCount(row);
  }
}
