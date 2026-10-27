import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js';
import { createValidationPipe } from './common/pipes/validation.pipe.js';
import { AppThrottlerGuard } from './common/rate-limit/app-throttler.guard.js';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { MailModule } from './infrastructure/mail/mail.module.js';
import { StorageModule } from './infrastructure/storage/storage.module.js';
import { AuditInterceptor } from './modules/audit/audit.interceptor.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuthGuard } from './modules/auth/guards/auth.guard.js';
import { OriginGuard } from './modules/auth/guards/origin.guard.js';
import { HealthModule } from './modules/health/health.module.js';
import { MediaModule } from './modules/media/media.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    MailModule,
    StorageModule,
    RateLimitModule,
    AuditModule,
    AuthModule,
    MediaModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useExisting: AuditInterceptor },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useExisting: AppThrottlerGuard },
  ],
})
export class AppModule {}
