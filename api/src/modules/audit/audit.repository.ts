import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AuditLog } from '../../generated/prisma/client.js';
import { PageRequest, toSkipTake } from '../../common/pagination/paginated.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

export interface AuditEntry {
  adminId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditFilters {
  entityType?: string;
  entityId?: string;
  adminId?: string;
}

export type AuditLogWithAdmin = AuditLog & { admin: { id: string; name: string } | null };

const ADMIN_SUMMARY = { select: { id: true, name: true } } as const;

@Injectable()
export class AuditRepository {
  constructor(private readonly database: PrismaService) {}

  async create({ metadata, ...entry }: AuditEntry): Promise<void> {
    await this.database.auditLog.create({ data: { ...entry, metadata: (metadata ?? {}) as Prisma.InputJsonObject } });
  }

  async findPage(
    filters: AuditFilters,
    page: PageRequest,
  ): Promise<{ items: AuditLogWithAdmin[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = { ...filters };
    const [items, total] = await this.database.$transaction([
      this.database.auditLog.findMany({
        where,
        include: { admin: ADMIN_SUMMARY },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(page),
      }),
      this.database.auditLog.count({ where }),
    ]);
    return { items, total };
  }

  findRecent(limit: number): Promise<AuditLogWithAdmin[]> {
    return this.database.auditLog.findMany({
      include: { admin: ADMIN_SUMMARY },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
