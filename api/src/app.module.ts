import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js';
import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), DatabaseModule, HealthModule],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule {}
