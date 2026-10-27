import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { HealthService } from './health.service.js';
import type { HealthStatus } from './health.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
