import { Injectable } from '@nestjs/common';
import type { Media, Testimonial } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { ContentRepository } from '../content.repository.js';

export type TestimonialRow = Testimonial & { avatar: Media | null };

export interface TestimonialData {
  clientName: string;
  clientRole: string | null;
  company: string | null;
  quote: string;
  avatarId: string | null;
  rating: number | null;
  clientApproved: boolean;
  isPublished: boolean;
  sortOrder: number;
}

const INCLUDE = { avatar: true } as const;

@Injectable()
export class TestimonialsRepository implements ContentRepository<TestimonialRow, TestimonialData> {
  constructor(private readonly database: PrismaService) {}

  findAll(): Promise<TestimonialRow[]> {
    return this.database.testimonial.findMany({ include: INCLUDE, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  findById(id: string): Promise<TestimonialRow | null> {
    return this.database.testimonial.findUnique({ where: { id }, include: INCLUDE });
  }

  create(data: TestimonialData): Promise<TestimonialRow> {
    return this.database.testimonial.create({ data, include: INCLUDE });
  }

  update(id: string, data: Partial<TestimonialData>): Promise<TestimonialRow> {
    return this.database.testimonial.update({ where: { id }, data, include: INCLUDE });
  }

  async delete(id: string): Promise<void> {
    await this.database.testimonial.delete({ where: { id } });
  }

  async nextSortOrder(): Promise<number> {
    const { _max } = await this.database.testimonial.aggregate({ _max: { sortOrder: true } });
    return (_max.sortOrder ?? -1) + 1;
  }
}
