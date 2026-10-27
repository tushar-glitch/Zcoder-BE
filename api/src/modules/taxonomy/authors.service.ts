import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { slugify, uniqueSlug } from '../../common/slug/slug.js';
import { isForeignKeyViolation, isUniqueViolation } from '../../infrastructure/database/prisma-errors.js';
import { RevalidationService } from '../../infrastructure/revalidation/revalidation.service.js';
import { AuthorsRepository } from './authors.repository.js';
import type { CreateAuthorDto, UpdateAuthorDto } from './dto/author.dto.js';
import { AuthorResponse, TaxonomyPresenter } from './taxonomy.presenter.js';

const FALLBACK_SLUG = 'author';
const REVALIDATED_TAGS = ['blogs'];

@Injectable()
export class AuthorsService {
  constructor(
    private readonly repository: AuthorsRepository,
    private readonly presenter: TaxonomyPresenter,
    private readonly revalidation: RevalidationService,
  ) {}

  async list(): Promise<AuthorResponse[]> {
    return (await this.repository.findAll()).map((author) => this.presenter.author(author));
  }

  async create(dto: CreateAuthorDto): Promise<AuthorResponse> {
    const slug = dto.slug ? await this.assertSlugFree(dto.slug) : await this.generateSlug(dto.name);

    const created = await this.write(() =>
      this.repository.create({ name: dto.name, slug, bio: dto.bio ?? null, avatarId: dto.avatarId ?? null }),
    );
    return this.published(created);
  }

  async update(id: string, dto: UpdateAuthorDto): Promise<AuthorResponse> {
    await this.findOrThrow(id);
    if (dto.slug) {
      await this.assertSlugFree(dto.slug, id);
    }

    const updated = await this.write(() =>
      this.repository.update(id, { name: dto.name ?? undefined, slug: dto.slug ?? undefined, bio: dto.bio, avatarId: dto.avatarId }),
    );
    return this.published(updated);
  }

  async delete(id: string): Promise<void> {
    await this.findOrThrow(id);

    try {
      await this.repository.delete(id);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Author is linked to blog posts');
      }
      throw error;
    }
    this.revalidation.revalidate(REVALIDATED_TAGS);
  }

  private async findOrThrow(id: string): Promise<void> {
    if (!(await this.repository.findById(id))) {
      throw new NotFoundException('Author not found');
    }
  }

  private async assertSlugFree(slug: string, excludeId?: string): Promise<string> {
    if (await this.repository.slugExists(slug, excludeId)) {
      throw new ConflictException('Author slug already exists');
    }
    return slug;
  }

  private generateSlug(name: string): Promise<string> {
    return uniqueSlug(slugify(name) || FALLBACK_SLUG, (candidate) => this.repository.slugExists(candidate));
  }

  private async write<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Author slug already exists');
      }
      if (isForeignKeyViolation(error)) {
        throw new ValidationException([{ path: 'avatarId', message: 'avatarId does not match any media' }]);
      }
      throw error;
    }
  }

  private published(author: Parameters<TaxonomyPresenter['author']>[0]): AuthorResponse {
    this.revalidation.revalidate(REVALIDATED_TAGS);
    return this.presenter.author(author);
  }
}
