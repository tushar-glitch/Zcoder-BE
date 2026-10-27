import { Injectable } from '@nestjs/common';
import type { Media, Service } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { ContentRepository } from '../content.repository.js';

export type ServiceRow = Service & { ogImage: Media | null };

export interface ServiceData {
  title: string;
  slug: string;
  icon: string | null;
  shortDescription: string | null;
  description: string | null;
  technologies: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageId: string | null;
  sortOrder: number;
  isPublished: boolean;
}

const INCLUDE = { ogImage: true } as const;

@Injectable()
export class ServicesRepository implements ContentRepository<ServiceRow, ServiceData> {
  constructor(private readonly database: PrismaService) {}

  findAll(): Promise<ServiceRow[]> {
    return this.database.service.findMany({ include: INCLUDE, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  findById(id: string): Promise<ServiceRow | null> {
    return this.database.service.findUnique({ where: { id }, include: INCLUDE });
  }

  create(data: ServiceData): Promise<ServiceRow> {
    return this.database.service.create({ data, include: INCLUDE });
  }

  update(id: string, data: Partial<ServiceData>): Promise<ServiceRow> {
    return this.database.service.update({ where: { id }, data, include: INCLUDE });
  }

  async delete(id: string): Promise<void> {
    await this.database.service.delete({ where: { id } });
  }

  async nextSortOrder(): Promise<number> {
    const { _max } = await this.database.service.aggregate({ _max: { sortOrder: true } });
    return (_max.sortOrder ?? -1) + 1;
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return (await this.database.service.count({ where: { slug, id: { not: excludeId } } })) > 0;
  }

  countPublished(excludeId: string): Promise<number> {
    return this.database.service.count({ where: { isPublished: true, id: { not: excludeId } } });
  }
}
