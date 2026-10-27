import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type { AuthorRow } from './taxonomy.presenter.js';

export interface AuthorData {
  name: string;
  slug: string;
  bio: string | null;
  avatarId: string | null;
}

const WITH_AVATAR = { avatar: true } as const;

@Injectable()
export class AuthorsRepository {
  constructor(private readonly database: PrismaService) {}

  findAll(): Promise<AuthorRow[]> {
    return this.database.author.findMany({ include: WITH_AVATAR, orderBy: { name: 'asc' } });
  }

  findById(id: string): Promise<AuthorRow | null> {
    return this.database.author.findUnique({ where: { id }, include: WITH_AVATAR });
  }

  create(data: AuthorData): Promise<AuthorRow> {
    return this.database.author.create({ data, include: WITH_AVATAR });
  }

  update(id: string, data: Partial<AuthorData>): Promise<AuthorRow> {
    return this.database.author.update({ where: { id }, data, include: WITH_AVATAR });
  }

  async delete(id: string): Promise<void> {
    await this.database.author.delete({ where: { id } });
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return (await this.database.author.count({ where: { slug, id: { not: excludeId } } })) > 0;
  }
}
