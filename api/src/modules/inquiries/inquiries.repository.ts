import { Injectable } from '@nestjs/common';
import { PageRequest, toSkipTake } from '../../common/pagination/paginated.js';
import type { SortDirection } from '../../common/pagination/sort.js';
import {
  Inquiry,
  InquiryReply,
  InquirySource,
  InquiryStatus,
  InquiryType,
  Prisma,
  ReplyDeliveryStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

export type ReplyRow = InquiryReply & { sentBy: { id: string; name: string } | null };
export type InquiryDetailRow = Inquiry & { replies: ReplyRow[] };

export interface NewInquiry {
  type: InquiryType;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  company: string | null;
  phone: string | null;
  serviceInterest: string | null;
  budgetRange: string | null;
  timeline: string | null;
  source: InquirySource;
  sourcePage: string | null;
}

export interface NewReply {
  inquiryId: string;
  subject: string;
  body: string;
  sentById: string;
}

export interface InquiryFilters {
  status?: InquiryStatus;
  type?: InquiryType;
  q?: string;
}

export type InquiryOrderBy = Partial<Record<'createdAt' | 'name', SortDirection>>;

const SENDER = { select: { id: true, name: true } } as const;
const DETAIL_INCLUDE = { replies: { include: { sentBy: SENDER }, orderBy: { createdAt: 'asc' } } } satisfies Prisma.InquiryInclude;
const REPLY_INCLUDE = { sentBy: SENDER } satisfies Prisma.InquiryReplyInclude;

@Injectable()
export class InquiriesRepository {
  constructor(private readonly database: PrismaService) {}

  async findPage(
    { status, type, q }: InquiryFilters,
    orderBy: InquiryOrderBy,
    page: PageRequest,
  ): Promise<{ items: Inquiry[]; total: number }> {
    const where: Prisma.InquiryWhereInput = {
      status,
      type,
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { subject: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.database.$transaction([
      this.database.inquiry.findMany({ where, orderBy, ...toSkipTake(page) }),
      this.database.inquiry.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<InquiryDetailRow | null> {
    return this.database.inquiry.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  }

  create(data: NewInquiry): Promise<Inquiry> {
    return this.database.inquiry.create({ data });
  }

  async delete(id: string): Promise<void> {
    await this.database.inquiry.delete({ where: { id } });
  }

  async updateStatus(id: string, status: InquiryStatus): Promise<void> {
    await this.database.inquiry.update({ where: { id }, data: { status } });
  }

  async existsSince(email: string, message: string, since: Date): Promise<boolean> {
    return (await this.database.inquiry.count({ where: { email, message, createdAt: { gte: since } } })) > 0;
  }

  createReply(data: NewReply): Promise<ReplyRow> {
    return this.database.inquiryReply.create({ data, include: REPLY_INCLUDE });
  }

  findReply(inquiryId: string, replyId: string): Promise<ReplyRow | null> {
    return this.database.inquiryReply.findFirst({ where: { id: replyId, inquiryId }, include: REPLY_INCLUDE });
  }

  async claimRetry(replyId: string, maxAttempts: number): Promise<boolean> {
    const { count } = await this.database.inquiryReply.updateMany({
      where: { id: replyId, deliveryStatus: ReplyDeliveryStatus.FAILED, attempts: { lt: maxAttempts } },
      data: { deliveryStatus: ReplyDeliveryStatus.PENDING },
    });
    return count === 1;
  }

  markReplySent(inquiryId: string, replyId: string, at: Date): Promise<ReplyRow> {
    return this.database.$transaction(async (transaction) => {
      await transaction.inquiry.update({ where: { id: inquiryId }, data: { status: InquiryStatus.REPLIED } });
      return transaction.inquiryReply.update({
        where: { id: replyId },
        data: { deliveryStatus: ReplyDeliveryStatus.SENT, sentAt: at, errorMessage: null, attempts: { increment: 1 } },
        include: REPLY_INCLUDE,
      });
    });
  }

  markReplyFailed(replyId: string, errorMessage: string): Promise<ReplyRow> {
    return this.database.inquiryReply.update({
      where: { id: replyId },
      data: { deliveryStatus: ReplyDeliveryStatus.FAILED, errorMessage, attempts: { increment: 1 } },
      include: REPLY_INCLUDE,
    });
  }
}
