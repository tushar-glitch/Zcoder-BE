import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuditLogResponse } from '../audit/audit-log.mapper.js';
import { InquiriesRepository } from '../inquiries/inquiries.repository.js';
import { InquirySummaryResponse, toInquirySummary } from '../inquiries/inquiry.presenter.js';
import { DashboardCounts, DashboardRepository } from './dashboard.repository.js';

export interface DashboardStats extends DashboardCounts {
  latestInquiries: InquirySummaryResponse[];
  recentActivity: AuditLogResponse[];
}

const WINDOW_DAYS = 30;
const LATEST_INQUIRIES = 5;
const RECENT_ACTIVITY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly inquiries: InquiriesRepository,
    private readonly audit: AuditService,
  ) {}

  async stats(): Promise<DashboardStats> {
    const [counts, latest, recentActivity] = await Promise.all([
      this.repository.counts(new Date(Date.now() - WINDOW_DAYS * DAY_MS)),
      this.inquiries.findPage({}, { createdAt: 'desc' }, { page: 1, pageSize: LATEST_INQUIRIES }),
      this.audit.recent(RECENT_ACTIVITY),
    ]);
    return { ...counts, latestInquiries: latest.items.map(toInquirySummary), recentActivity };
  }
}
