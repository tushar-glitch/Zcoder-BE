import { ExecutionContext, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard.js';
import { RATE_LIMITS } from './rate-limit.constants.js';

const isAdminRequest = (context: ExecutionContext): boolean => Boolean(context.switchToHttp().getRequest().admin);

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: RATE_LIMITS.public.ttl,
          limit: (context) => (isAdminRequest(context) ? RATE_LIMITS.admin.limit : RATE_LIMITS.public.limit),
        },
      ],
    }),
  ],
  providers: [AppThrottlerGuard],
  exports: [AppThrottlerGuard],
})
export class RateLimitModule {}
