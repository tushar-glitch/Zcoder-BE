import { randomUUID } from 'node:crypto';
import type { Admin, AdminSession } from '../../src/generated/prisma/client.js';
import { MailMessage, MailSender } from '../../src/infrastructure/mail/mail-sender.js';
import type { NewAdmin } from '../../src/modules/auth/admin.repository.js';
import type { NewPasswordResetToken } from '../../src/modules/auth/password-reset.repository.js';
import type { LockState } from '../../src/modules/auth/security/account-lock.policy.js';
import type { NewSession, SessionWithAdmin, TokenRotation } from '../../src/modules/auth/session.repository.js';

export class InMemoryAdminRepository {
  readonly admins = new Map<string, Admin>();

  async findByEmail(email: string): Promise<Admin | null> {
    return [...this.admins.values()].find((admin) => admin.email === email) ?? null;
  }

  async findById(id: string): Promise<Admin | null> {
    return this.admins.get(id) ?? null;
  }

  async create({ name, email, passwordHash }: NewAdmin): Promise<Admin> {
    const admin: Admin = {
      id: randomUUID(),
      name,
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.admins.set(admin.id, admin);
    return admin;
  }

  async saveLockState(id: string, state: LockState): Promise<void> {
    Object.assign(this.admins.get(id)!, state);
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    Object.assign(this.admins.get(id)!, { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: at });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    this.admins.get(id)!.passwordHash = passwordHash;
  }
}

export class InMemorySessionRepository {
  readonly sessions = new Map<string, AdminSession>();

  constructor(private readonly admins: InMemoryAdminRepository) {}

  async create({ adminId, tokenHash, expiresAt }: NewSession): Promise<AdminSession> {
    const session: AdminSession = {
      id: randomUUID(),
      adminId,
      tokenHash,
      previousTokenHash: null,
      expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findActiveById(id: string, now: Date): Promise<SessionWithAdmin | null> {
    const session = this.sessions.get(id);
    const admin = session && this.admins.admins.get(session.adminId);
    const active = session && admin && !session.revokedAt && session.expiresAt > now && admin.isActive;
    return active ? { ...session, admin } : null;
  }

  async findByTokenHash(tokenHash: string): Promise<SessionWithAdmin | null> {
    const session = [...this.sessions.values()].find(
      (candidate) => candidate.tokenHash === tokenHash || candidate.previousTokenHash === tokenHash,
    );
    const admin = session && this.admins.admins.get(session.adminId);
    return session && admin ? { ...session, admin } : null;
  }

  async rotate(id: string, { currentTokenHash, newTokenHash, expiresAt }: TokenRotation): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session || session.tokenHash !== currentTokenHash || session.revokedAt) {
      return false;
    }
    Object.assign(session, { tokenHash: newTokenHash, previousTokenHash: currentTokenHash, expiresAt });
    return true;
  }

  async revoke(id: string, at: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session && !session.revokedAt) {
      session.revokedAt = at;
    }
  }

  async revokeAllForAdmin(adminId: string, at: Date, exceptSessionId?: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.adminId === adminId && session.id !== exceptSessionId && !session.revokedAt) {
        session.revokedAt = at;
      }
    }
  }
}

export class CapturingMailSender extends MailSender {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}

export class InMemoryPasswordResetRepository {
  readonly tokens: { adminId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }[] = [];

  constructor(private readonly admins: InMemoryAdminRepository) {}

  async replaceOutstanding({ adminId, tokenHash, expiresAt }: NewPasswordResetToken, now: Date): Promise<void> {
    this.tokens.filter((token) => token.adminId === adminId && !token.usedAt).forEach((token) => (token.usedAt = now));
    this.tokens.push({ adminId, tokenHash, expiresAt, usedAt: null });
  }

  async consume(tokenHash: string, now: Date): Promise<string | null> {
    const token = this.tokens.find((candidate) => candidate.tokenHash === tokenHash);
    const admin = token && this.admins.admins.get(token.adminId);
    if (!token || !admin?.isActive || token.usedAt || token.expiresAt <= now) {
      return null;
    }
    token.usedAt = now;
    return token.adminId;
  }
}
