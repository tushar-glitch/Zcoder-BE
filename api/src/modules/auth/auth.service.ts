import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { Admin } from '../../generated/prisma/client.js';
import { AdminRepository } from './admin.repository.js';
import { REFRESH_TOKEN_TTL_SECONDS } from './auth.constants.js';
import { AccountLockedException } from './exceptions/account-locked.exception.js';
import { AccountLockPolicy } from './security/account-lock.policy.js';
import { PasswordHasher } from './security/password-hasher.js';
import { TokenService } from './security/token.service.js';
import { SessionRepository } from './session.repository.js';
import type { AuthenticatedAdmin } from './mappers/admin.mapper.js';

export interface AuthResult {
  admin: Admin;
  accessToken: string;
  refreshToken: string;
}

const INVALID_CREDENTIALS = 'Invalid email or password';
const AUTHENTICATION_REQUIRED = 'Authentication required';
const DUMMY_PASSWORD = 'timing-equalisation-password';

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly admins: AdminRepository,
    private readonly sessions: SessionRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly lockPolicy: AccountLockPolicy,
  ) {}

  async login(email: string, password: string): Promise<AuthResult> {
    const now = new Date();
    const admin = await this.admins.findByEmail(email);

    if (!admin || !admin.isActive) {
      await this.hasher.verify(password, await this.getDummyHash());
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (this.lockPolicy.isLocked(admin, now)) {
      throw new AccountLockedException(this.lockPolicy.retryAfterSeconds(admin, now));
    }
    if (!(await this.hasher.verify(password, admin.passwordHash))) {
      await this.rejectFailedPassword(admin, now);
    }

    await this.admins.recordLogin(admin.id, now);
    return this.startSession(admin, now);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException(AUTHENTICATION_REQUIRED);
    }

    const now = new Date();
    const currentTokenHash = this.tokens.hashOpaqueToken(refreshToken);
    const session = await this.sessions.findByTokenHash(currentTokenHash);

    if (!session || session.revokedAt || session.expiresAt <= now || !session.admin.isActive) {
      throw new UnauthorizedException(AUTHENTICATION_REQUIRED);
    }

    const newToken = this.tokens.generateOpaqueToken();
    const isCurrentToken = session.tokenHash === currentTokenHash;
    const rotated =
      isCurrentToken &&
      (await this.sessions.rotate(session.id, {
        currentTokenHash,
        newTokenHash: this.tokens.hashOpaqueToken(newToken),
        expiresAt: this.refreshExpiry(now),
      }));

    if (!rotated) {
      await this.sessions.revoke(session.id, now);
      throw new UnauthorizedException(AUTHENTICATION_REQUIRED);
    }

    const accessToken = await this.tokens.signAccessToken({ adminId: session.adminId, sessionId: session.id });
    return { admin: session.admin, accessToken, refreshToken: newToken };
  }

  async logout(refreshToken: string | undefined, accessToken: string | undefined): Promise<void> {
    const sessionId = await this.findSessionId(refreshToken, accessToken);
    if (sessionId) {
      await this.sessions.revoke(sessionId, new Date());
    }
  }

  async changePassword(current: AuthenticatedAdmin, currentPassword: string, newPassword: string): Promise<void> {
    const admin = await this.admins.findById(current.id);

    if (!admin || !(await this.hasher.verify(currentPassword, admin.passwordHash))) {
      throw new ValidationException([{ path: 'currentPassword', message: 'Current password is incorrect' }]);
    }

    await this.admins.updatePasswordHash(admin.id, await this.hasher.hash(newPassword));
    await this.sessions.revokeAllForAdmin(admin.id, new Date(), current.sessionId);
  }

  private async rejectFailedPassword(admin: Admin, now: Date): Promise<never> {
    const state = this.lockPolicy.afterFailure(admin, now);
    await this.admins.saveLockState(admin.id, state);

    if (this.lockPolicy.isLocked(state, now)) {
      throw new AccountLockedException(this.lockPolicy.retryAfterSeconds(state, now));
    }
    throw new UnauthorizedException(INVALID_CREDENTIALS);
  }

  private async startSession(admin: Admin, now: Date): Promise<AuthResult> {
    const refreshToken = this.tokens.generateOpaqueToken();
    const session = await this.sessions.create({
      adminId: admin.id,
      tokenHash: this.tokens.hashOpaqueToken(refreshToken),
      expiresAt: this.refreshExpiry(now),
    });
    const accessToken = await this.tokens.signAccessToken({ adminId: admin.id, sessionId: session.id });

    return { admin, accessToken, refreshToken };
  }

  private async findSessionId(refreshToken?: string, accessToken?: string): Promise<string | undefined> {
    if (refreshToken) {
      const session = await this.sessions.findByTokenHash(this.tokens.hashOpaqueToken(refreshToken));
      if (session) {
        return session.id;
      }
    }
    return accessToken ? (await this.tokens.verifyAccessToken(accessToken))?.sessionId : undefined;
  }

  private refreshExpiry(now: Date): Date {
    return new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(DUMMY_PASSWORD);
    return this.dummyHash;
  }
}
