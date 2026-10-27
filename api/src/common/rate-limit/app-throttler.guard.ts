import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Environment } from '../../config/environment.js';
import { INTERNAL_SECRET_HEADER } from './rate-limit.constants.js';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly internalSecretDigest: Buffer;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    config: ConfigService<Environment, true>,
  ) {
    super(options, storage, reflector);
    this.headerPrefix = 'RateLimit';
    this.internalSecretDigest = digest(config.get('INTERNAL_SECRET', { infer: true }));
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const provided = context.switchToHttp().getRequest().headers[INTERNAL_SECRET_HEADER];
    return typeof provided === 'string' && timingSafeEqual(digest(provided), this.internalSecretDigest);
  }

  protected async getTracker(request: Record<string, any>): Promise<string> {
    return request.admin ? `admin:${request.admin.id}` : request.ip;
  }
}
