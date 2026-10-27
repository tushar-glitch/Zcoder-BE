import { randomUUID } from 'node:crypto';
import type { PageRequest } from '../../src/common/pagination/paginated.js';
import { Inquiry, InquiryReply, InquiryStatus, ReplyDeliveryStatus } from '../../src/generated/prisma/client.js';
import type {
  InquiryDetailRow,
  InquiryFilters,
  InquiryOrderBy,
  NewInquiry,
  NewReply,
  ReplyRow,
} from '../../src/modules/inquiries/inquiries.repository.js';
import type { InMemoryAdminRepository } from './in-memory-auth.js';

export class InMemoryInquiriesRepository {
  readonly inquiries = new Map<string, Inquiry>();
  readonly replies = new Map<string, InquiryReply>();

  constructor(private readonly admins: InMemoryAdminRepository) {}

  private hydrateReply(reply: InquiryReply): ReplyRow {
    const admin = reply.sentById ? this.admins.admins.get(reply.sentById) : undefined;
    return { ...reply, sentBy: admin ? { id: admin.id, name: admin.name } : null };
  }

  async findPage({ status, type, q }: InquiryFilters, orderBy: InquiryOrderBy, { page, pageSize }: PageRequest) {
    const needle = q?.toLowerCase();
    const [[field, direction]] = Object.entries(orderBy) as [['createdAt' | 'name', 'asc' | 'desc']];
    const matching = [...this.inquiries.values()]
      .filter((row) => !status || row.status === status)
      .filter((row) => !type || row.type === type)
      .filter((row) => !needle || `${row.name} ${row.email} ${row.subject ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * (direction === 'asc' ? 1 : -1));
    return { items: matching.slice((page - 1) * pageSize, page * pageSize), total: matching.length };
  }

  async findById(id: string): Promise<InquiryDetailRow | null> {
    const inquiry = this.inquiries.get(id);
    if (!inquiry) {
      return null;
    }
    const replies = [...this.replies.values()]
      .filter((reply) => reply.inquiryId === id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((reply) => this.hydrateReply(reply));
    return { ...inquiry, replies };
  }

  async create(data: NewInquiry): Promise<Inquiry> {
    const inquiry: Inquiry = { id: randomUUID(), ...data, status: InquiryStatus.NEW, createdAt: new Date(), updatedAt: new Date() };
    this.inquiries.set(inquiry.id, inquiry);
    return inquiry;
  }

  async delete(id: string): Promise<void> {
    this.inquiries.delete(id);
    [...this.replies.values()].filter((reply) => reply.inquiryId === id).forEach((reply) => this.replies.delete(reply.id));
  }

  async updateStatus(id: string, status: InquiryStatus): Promise<void> {
    this.inquiries.get(id)!.status = status;
  }

  async existsSince(email: string, message: string, since: Date): Promise<boolean> {
    return [...this.inquiries.values()].some((row) => row.email === email && row.message === message && row.createdAt >= since);
  }

  async createReply({ inquiryId, subject, body, sentById }: NewReply): Promise<ReplyRow> {
    const reply: InquiryReply = {
      id: randomUUID(),
      inquiryId,
      subject,
      body,
      deliveryStatus: ReplyDeliveryStatus.PENDING,
      errorMessage: null,
      attempts: 0,
      sentAt: null,
      sentById,
      createdAt: new Date(),
    };
    this.replies.set(reply.id, reply);
    return this.hydrateReply(reply);
  }

  async findReply(inquiryId: string, replyId: string): Promise<ReplyRow | null> {
    const reply = this.replies.get(replyId);
    return reply?.inquiryId === inquiryId ? this.hydrateReply(reply) : null;
  }

  async claimRetry(replyId: string, maxAttempts: number): Promise<boolean> {
    const reply = this.replies.get(replyId);
    if (!reply || reply.deliveryStatus !== ReplyDeliveryStatus.FAILED || reply.attempts >= maxAttempts) {
      return false;
    }
    reply.deliveryStatus = ReplyDeliveryStatus.PENDING;
    return true;
  }

  async markReplySent(inquiryId: string, replyId: string, at: Date): Promise<ReplyRow> {
    this.inquiries.get(inquiryId)!.status = InquiryStatus.REPLIED;
    const reply = this.replies.get(replyId)!;
    Object.assign(reply, { deliveryStatus: ReplyDeliveryStatus.SENT, sentAt: at, errorMessage: null, attempts: reply.attempts + 1 });
    return this.hydrateReply(reply);
  }

  async markReplyFailed(replyId: string, errorMessage: string): Promise<ReplyRow> {
    const reply = this.replies.get(replyId)!;
    Object.assign(reply, { deliveryStatus: ReplyDeliveryStatus.FAILED, errorMessage, attempts: reply.attempts + 1 });
    return this.hydrateReply(reply);
  }
}
