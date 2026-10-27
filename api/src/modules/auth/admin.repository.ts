import { Injectable } from '@nestjs/common';
import type { Admin } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type { LockState } from './security/account-lock.policy.js';

export interface NewAdmin {
  name: string;
  email: string;
  passwordHash: string;
}

@Injectable()
export class AdminRepository {
  constructor(private readonly database: PrismaService) {}

  findByEmail(email: string): Promise<Admin | null> {
    return this.database.admin.findUnique({ where: { email } });
  }

  findById(id: string): Promise<Admin | null> {
    return this.database.admin.findUnique({ where: { id } });
  }

  create(admin: NewAdmin): Promise<Admin> {
    return this.database.admin.create({ data: admin });
  }

  async saveLockState(id: string, state: LockState): Promise<void> {
    await this.database.admin.update({ where: { id }, data: state });
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    await this.database.admin.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: at },
    });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.database.admin.update({ where: { id }, data: { passwordHash } });
  }
}
