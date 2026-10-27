import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { Environment } from '../../config/environment.js';
import { MailSender } from '../../infrastructure/mail/mail-sender.js';
import { AdminRepository } from './admin.repository.js';
import { PASSWORD_RESET_TTL_SECONDS } from './auth.constants.js';
import { PasswordResetRepository } from './password-reset.repository.js';
import { AccountLockPolicy } from './security/account-lock.policy.js';
import { PasswordHasher } from './security/password-hasher.js';
import { TokenService } from './security/token.service.js';
import { SessionRepository } from './session.repository.js';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly admins: AdminRepository,
    private readonly sessions: SessionRepository,
    private readonly resets: PasswordResetRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly lockPolicy: AccountLockPolicy,
    private readonly mail: MailSender,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  request(email: string): void {
    void this.sendResetLink(email).catch((error: unknown) =>
      this.logger.error('Password reset request failed', error instanceof Error ? error.stack : String(error)),
    );
  }

  async reset(token: string, newPassword: string): Promise<void> {
    const now = new Date();
    const adminId = await this.resets.consume(this.tokens.hashOpaqueToken(token), now);

    if (!adminId) {
      throw new ValidationException([{ path: 'token', message: 'Invalid or expired token' }]);
    }

    await this.admins.updatePasswordHash(adminId, await this.hasher.hash(newPassword));
    await this.admins.saveLockState(adminId, this.lockPolicy.afterSuccess());
    await this.sessions.revokeAllForAdmin(adminId, now);
  }

  private async sendResetLink(email: string): Promise<void> {
    const admin = await this.admins.findByEmail(email);
    if (!admin?.isActive) {
      return;
    }

    const now = new Date();
    const token = this.tokens.generateOpaqueToken();
    await this.resets.replaceOutstanding(
      {
        adminId: admin.id,
        tokenHash: this.tokens.hashOpaqueToken(token),
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_SECONDS * 1000),
      },
      now,
    );

    const link = new URL('/admin/reset-password', this.config.get('APP_URL', { infer: true }));
    link.searchParams.set('token', token);
    await this.mail.send({
      to: admin.email,
      subject: 'Reset your ZoyCoders admin password',
      text: `Use this link to set a new password. It works once and expires in 30 minutes.\n\n${link.toString()}\n\nIf you did not ask for this, you can ignore this email.`,
    });
  }
}
