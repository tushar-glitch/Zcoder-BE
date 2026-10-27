import { Injectable } from '@nestjs/common';
import { BlogStatus, InquiryStatus, ReplyDeliveryStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

export interface DashboardCounts {
  newInquiries: number;
  inProgressInquiries: number;
  inquiriesLast30Days: number;
  failedReplies: number;
  publishedBlogs: number;
  draftBlogs: number;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly database: PrismaService) {}

  async counts(since: Date): Promise<DashboardCounts> {
    const [newInquiries, inProgressInquiries, inquiriesLast30Days, failedReplies, publishedBlogs, draftBlogs] =
      await this.database.$transaction([
        this.database.inquiry.count({ where: { status: InquiryStatus.NEW } }),
        this.database.inquiry.count({ where: { status: InquiryStatus.IN_PROGRESS } }),
        this.database.inquiry.count({ where: { createdAt: { gte: since } } }),
        this.database.inquiryReply.count({ where: { deliveryStatus: ReplyDeliveryStatus.FAILED } }),
        this.database.blog.count({ where: { status: BlogStatus.PUBLISHED } }),
        this.database.blog.count({ where: { status: BlogStatus.DRAFT } }),
      ]);
    return { newInquiries, inProgressInquiries, inquiriesLast30Days, failedReplies, publishedBlogs, draftBlogs };
  }
}
