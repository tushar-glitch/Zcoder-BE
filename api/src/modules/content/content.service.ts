import { ConflictException, NotFoundException } from '@nestjs/common';
import { isForeignKeyViolation, isUniqueViolation } from '../../infrastructure/database/prisma-errors.js';
import { RevalidationService } from '../../infrastructure/revalidation/revalidation.service.js';
import type { ContentRepository } from './content.repository.js';

export abstract class ContentService<
  TRow extends { id: string },
  TResponse,
  TCreate,
  TUpdate,
  TData extends { sortOrder: number },
> {
  protected constructor(
    protected readonly repository: ContentRepository<TRow, TData>,
    private readonly revalidation: RevalidationService,
    private readonly label: string,
  ) {}

  protected abstract present(row: TRow): TResponse;
  protected abstract toData(dto: TCreate | TUpdate, current?: TRow): Promise<Partial<TData>>;
  protected abstract revalidationTags(row: TRow): string[];

  protected async validateCreate(_dto: TCreate): Promise<void> {}
  protected async validateUpdate(_current: TRow, _dto: TUpdate): Promise<void> {}
  protected async validateDelete(_current: TRow): Promise<void> {}

  async list(): Promise<TResponse[]> {
    return (await this.repository.findAll()).map((row) => this.present(row));
  }

  async get(id: string): Promise<TResponse> {
    return this.present(await this.findOrThrow(id));
  }

  async create(dto: TCreate): Promise<TResponse> {
    await this.validateCreate(dto);
    const data = await this.toData(dto);
    const sortOrder = data.sortOrder ?? (await this.repository.nextSortOrder());

    const created = await this.guard(() => this.repository.create({ ...data, sortOrder } as TData));
    this.revalidation.revalidate(this.revalidationTags(created));
    return this.present(created);
  }

  async update(id: string, dto: TUpdate): Promise<TResponse> {
    const current = await this.findOrThrow(id);
    await this.validateUpdate(current, dto);
    const data = await this.toData(dto, current);

    const updated = await this.guard(() => this.repository.update(id, data));
    this.revalidation.revalidate([...this.revalidationTags(current), ...this.revalidationTags(updated)]);
    return this.present(updated);
  }

  async delete(id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    await this.validateDelete(current);

    try {
      await this.repository.delete(id);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(`${this.label} is still in use`);
      }
      throw error;
    }
    this.revalidation.revalidate(this.revalidationTags(current));
  }

  protected async findOrThrow(id: string): Promise<TRow> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException(`${this.label} not found`);
    }
    return row;
  }

  private async guard<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`${this.label} slug already exists`);
      }
      throw error;
    }
  }
}
