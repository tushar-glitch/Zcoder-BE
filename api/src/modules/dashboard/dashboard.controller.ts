import { Controller, Get } from '@nestjs/common';
import { DashboardService, DashboardStats } from './dashboard.service.js';

@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  stats(): Promise<DashboardStats> {
    return this.dashboard.stats();
  }
}
