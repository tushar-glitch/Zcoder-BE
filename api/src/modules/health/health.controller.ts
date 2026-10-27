import { Controller, Get, Header } from '@nestjs/common';
import { HealthService } from './health.service.js';
import type { HealthStatus } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  check(): HealthStatus {
    return this.healthService.check();
  }
}
