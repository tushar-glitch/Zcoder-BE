import { Module } from '@nestjs/common';
import { InquiriesModule } from '../inquiries/inquiries.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardRepository } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [InquiriesModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
})
export class DashboardModule {}
