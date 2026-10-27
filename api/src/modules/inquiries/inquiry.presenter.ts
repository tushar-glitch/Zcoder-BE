import { Inquiry, InquirySource, InquiryStatus, InquiryType, ReplyDeliveryStatus } from '../../generated/prisma/client.js';
import type { InquiryDetailRow, ReplyRow } from './inquiries.repository.js';

export interface InquirySummaryResponse {
  id: string;
  type: InquiryType;
  name: string;
  email: string;
  subject: string | null;
  serviceInterest: string | null;
  source: InquirySource;
  status: InquiryStatus;
  createdAt: Date;
}

export interface ReplyResponse {
  id: string;
  subject: string;
  body: string;
  deliveryStatus: ReplyDeliveryStatus;
  errorMessage: string | null;
  attempts: number;
  sentAt: Date | null;
  sentBy: { id: string; name: string } | null;
  createdAt: Date;
}

export interface InquiryResponse extends InquirySummaryResponse {
  message: string;
  company: string | null;
  phone: string | null;
  budgetRange: string | null;
  timeline: string | null;
  sourcePage: string | null;
  replies: ReplyResponse[];
}

export interface ReplyOutcome {
  reply: ReplyResponse;
  inquiryStatus: InquiryStatus;
}

export const toInquirySummary = (inquiry: Inquiry): InquirySummaryResponse => ({
  id: inquiry.id,
  type: inquiry.type,
  name: inquiry.name,
  email: inquiry.email,
  subject: inquiry.subject,
  serviceInterest: inquiry.serviceInterest,
  source: inquiry.source,
  status: inquiry.status,
  createdAt: inquiry.createdAt,
});

export const toReplyResponse = (reply: ReplyRow): ReplyResponse => ({
  id: reply.id,
  subject: reply.subject,
  body: reply.body,
  deliveryStatus: reply.deliveryStatus,
  errorMessage: reply.errorMessage,
  attempts: reply.attempts,
  sentAt: reply.sentAt,
  sentBy: reply.sentBy,
  createdAt: reply.createdAt,
});

export const toInquiryResponse = (inquiry: InquiryDetailRow): InquiryResponse => ({
  ...toInquirySummary(inquiry),
  message: inquiry.message,
  company: inquiry.company,
  phone: inquiry.phone,
  budgetRange: inquiry.budgetRange,
  timeline: inquiry.timeline,
  sourcePage: inquiry.sourcePage,
  replies: inquiry.replies.map(toReplyResponse),
});
