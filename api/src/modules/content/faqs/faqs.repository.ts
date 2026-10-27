import { Injectable } from '@nestjs/common';
import type { Faq } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { ContentRepository } from '../content.repository.js';

export interface FaqData {
  question: string;
  answer: string;
  group: string | null;
  showOnHome: boolean;
  isPublished: boolean;
  sortOrder: number;
}

@Injectable()
export class FaqsRepository implements ContentRepository<Faq, FaqData> {
  constructor(private readonly database: PrismaService) {}

  findAll(): Promise<Faq[]> {
    return this.database.faq.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  findById(id: string): Promise<Faq | null> {
    return this.database.faq.findUnique({ where: { id } });
  }

  create(data: FaqData): Promise<Faq> {
    return this.database.faq.create({ data });
  }

  update(id: string, data: Partial<FaqData>): Promise<Faq> {
    return this.database.faq.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.database.faq.delete({ where: { id } });
  }

  async nextSortOrder(): Promise<number> {
    const { _max } = await this.database.faq.aggregate({ _max: { sortOrder: true } });
    return (_max.sortOrder ?? -1) + 1;
  }

  countShownOnHome(excludeId?: string): Promise<number> {
    return this.database.faq.count({ where: { showOnHome: true, id: { not: excludeId } } });
  }
}
