import { BlogStatus, InquiryStatus, ReplyDeliveryStatus } from '../../src/generated/prisma/client.js';
import type { DashboardCounts } from '../../src/modules/dashboard/dashboard.repository.js';
import type { InMemoryCatalog } from './in-memory-blogs.js';
import type { InMemoryInquiriesRepository } from './in-memory-inquiries.js';

export class InMemoryDashboardRepository {
  constructor(
    private readonly inquiries: InMemoryInquiriesRepository,
    private readonly catalog: InMemoryCatalog,
  ) {}

  async counts(since: Date): Promise<DashboardCounts> {
    const inquiries = [...this.inquiries.inquiries.values()];
    const blogs = [...this.catalog.blogs.values()];
    return {
      newInquiries: inquiries.filter((row) => row.status === InquiryStatus.NEW).length,
      inProgressInquiries: inquiries.filter((row) => row.status === InquiryStatus.IN_PROGRESS).length,
      inquiriesLast30Days: inquiries.filter((row) => row.createdAt >= since).length,
      failedReplies: [...this.inquiries.replies.values()].filter((row) => row.deliveryStatus === ReplyDeliveryStatus.FAILED).length,
      publishedBlogs: blogs.filter((row) => row.status === BlogStatus.PUBLISHED).length,
      draftBlogs: blogs.filter((row) => row.status === BlogStatus.DRAFT).length,
    };
  }
}
