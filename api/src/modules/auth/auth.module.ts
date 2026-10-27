import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Environment } from '../../config/environment.js';
import { AdminRepository } from './admin.repository.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordResetRepository } from './password-reset.repository.js';
import { PasswordResetService } from './password-reset.service.js';
import { AccountLockPolicy } from './security/account-lock.policy.js';
import { PasswordHasher } from './security/password-hasher.js';
import { ScryptPasswordHasher } from './security/scrypt-password-hasher.js';
import { TokenService } from './security/token.service.js';
import { SessionCookies } from './session-cookies.js';
import { SessionRepository } from './session.repository.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordResetService,
    AdminRepository,
    PasswordResetRepository,
    SessionRepository,
    SessionCookies,
    TokenService,
    AccountLockPolicy,
    { provide: PasswordHasher, useClass: ScryptPasswordHasher },
  ],
  exports: [TokenService, SessionRepository],
})
export class AuthModule {}
