import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

export interface NewPasswordResetToken {
  adminId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetRepository {
  constructor(private readonly database: PrismaService) {}

  async replaceOutstanding(token: NewPasswordResetToken, now: Date): Promise<void> {
    await this.database.$transaction([
      this.database.passwordResetToken.updateMany({
        where: { adminId: token.adminId, usedAt: null },
        data: { usedAt: now },
      }),
      this.database.passwordResetToken.create({ data: token }),
    ]);
  }

  async consume(tokenHash: string, now: Date): Promise<string | null> {
    const token = await this.database.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now }, admin: { isActive: true } },
    });
    if (!token) {
      return null;
    }

    const { count } = await this.database.passwordResetToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: now },
    });
    return count === 1 ? token.adminId : null;
  }
}
