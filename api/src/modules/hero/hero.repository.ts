import { Injectable } from '@nestjs/common';
import { Hero, HeroStatus, Media } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

export type HeroRow = Hero & { image: Media | null };

export interface HeroData {
  title?: string;
  heading?: string | null;
  subheading?: string | null;
  primaryCtaLabel?: string | null;
  primaryCtaUrl?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryCtaUrl?: string | null;
  imageId?: string | null;
}

const INCLUDE = { image: true } as const;

@Injectable()
export class HeroRepository {
  constructor(private readonly database: PrismaService) {}

  findAll(): Promise<HeroRow[]> {
    return this.database.hero.findMany({ include: INCLUDE, orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }] });
  }

  findById(id: string): Promise<HeroRow | null> {
    return this.database.hero.findUnique({ where: { id }, include: INCLUDE });
  }

  create(data: HeroData & { title: string }): Promise<HeroRow> {
    return this.database.hero.create({ data, include: INCLUDE });
  }

  update(id: string, data: HeroData): Promise<HeroRow> {
    return this.database.hero.update({ where: { id }, data, include: INCLUDE });
  }

  async delete(id: string): Promise<void> {
    await this.database.hero.delete({ where: { id } });
  }

  publishOnly(id: string): Promise<HeroRow> {
    return this.database.$transaction(async (transaction) => {
      await transaction.hero.updateMany({
        where: { status: HeroStatus.PUBLISHED, id: { not: id } },
        data: { status: HeroStatus.DRAFT },
      });
      return transaction.hero.update({ where: { id }, data: { status: HeroStatus.PUBLISHED }, include: INCLUDE });
    });
  }

  unpublish(id: string): Promise<HeroRow> {
    return this.database.hero.update({ where: { id }, data: { status: HeroStatus.DRAFT }, include: INCLUDE });
  }
}
