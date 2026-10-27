import { Injectable } from '@nestjs/common';
import type { Admin, AdminSession } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

export type SessionWithAdmin = AdminSession & { admin: Admin };

export interface NewSession {
  adminId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface TokenRotation {
  currentTokenHash: string;
  newTokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class SessionRepository {
  constructor(private readonly database: PrismaService) {}

  create(session: NewSession): Promise<AdminSession> {
    return this.database.adminSession.create({ data: session });
  }

  findActiveById(id: string, now: Date): Promise<SessionWithAdmin | null> {
    return this.database.adminSession.findFirst({
      where: { id, revokedAt: null, expiresAt: { gt: now }, admin: { isActive: true } },
      include: { admin: true },
    });
  }

  findByTokenHash(tokenHash: string): Promise<SessionWithAdmin | null> {
    return this.database.adminSession.findFirst({
      where: { OR: [{ tokenHash }, { previousTokenHash: tokenHash }] },
      include: { admin: true },
    });
  }

  async rotate(id: string, { currentTokenHash, newTokenHash, expiresAt }: TokenRotation): Promise<boolean> {
    const { count } = await this.database.adminSession.updateMany({
      where: { id, tokenHash: currentTokenHash, revokedAt: null },
      data: { tokenHash: newTokenHash, previousTokenHash: currentTokenHash, expiresAt },
    });
    return count === 1;
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.database.adminSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: at } });
  }

  async revokeAllForAdmin(adminId: string, at: Date, exceptSessionId?: string): Promise<void> {
    await this.database.adminSession.updateMany({
      where: { adminId, revokedAt: null, id: { not: exceptSessionId } },
      data: { revokedAt: at },
    });
  }
}
