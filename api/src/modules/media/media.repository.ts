import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { Media } from '../../generated/prisma/client.js';
import { PageRequest, toSkipTake } from '../../common/pagination/paginated.js';
import type { SortDirection } from '../../common/pagination/sort.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

export interface NewMedia {
  fileName: string;
  altText: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface MediaQuery {
  q?: string;
  orderBy: Partial<Record<'createdAt' | 'fileName', SortDirection>>;
}

@Injectable()
export class MediaRepository {
  constructor(private readonly database: PrismaService) {}

  create(media: NewMedia): Promise<Media> {
    return this.database.media.create({ data: media });
  }

  findById(id: string): Promise<Media | null> {
    return this.database.media.findUnique({ where: { id } });
  }

  async findPage({ q, orderBy }: MediaQuery, page: PageRequest): Promise<{ items: Media[]; total: number }> {
    const where: Prisma.MediaWhereInput = q
      ? {
          OR: [
            { fileName: { contains: q, mode: 'insensitive' } },
            { altText: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.database.$transaction([
      this.database.media.findMany({ where, orderBy, ...toSkipTake(page) }),
      this.database.media.count({ where }),
    ]);
    return { items, total };
  }

  updateAltText(id: string, altText: string): Promise<Media> {
    return this.database.media.update({ where: { id }, data: { altText } });
  }

  async delete(id: string): Promise<void> {
    await this.database.media.delete({ where: { id } });
  }
}
