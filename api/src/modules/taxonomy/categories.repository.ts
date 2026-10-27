import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type { TaxonomyRowWithCount } from './taxonomy.presenter.js';
import { TaxonomyData, TaxonomyRepository } from './taxonomy.repository.js';

const WITH_COUNT = { _count: { select: { blogs: true } } } as const;

@Injectable()
export class CategoriesRepository extends TaxonomyRepository {
  constructor(private readonly database: PrismaService) {
    super();
  }

  findAll(): Promise<TaxonomyRowWithCount[]> {
    return this.database.category.findMany({ include: WITH_COUNT, orderBy: { name: 'asc' } });
  }

  findById(id: string): Promise<TaxonomyRowWithCount | null> {
    return this.database.category.findUnique({ where: { id }, include: WITH_COUNT });
  }

  create(data: TaxonomyData): Promise<TaxonomyRowWithCount> {
    return this.database.category.create({ data, include: WITH_COUNT });
  }

  update(id: string, data: Partial<TaxonomyData>): Promise<TaxonomyRowWithCount> {
    return this.database.category.update({ where: { id }, data, include: WITH_COUNT });
  }

  async delete(id: string): Promise<void> {
    await this.database.category.delete({ where: { id } });
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return (await this.database.category.count({ where: { slug, id: { not: excludeId } } })) > 0;
  }

  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    return (await this.database.category.count({ where: { name: { equals: name, mode: 'insensitive' }, id: { not: excludeId } } })) > 0;
  }
}
