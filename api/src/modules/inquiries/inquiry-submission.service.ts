import { Injectable } from '@nestjs/common';
import { InquirySource } from '../../generated/prisma/client.js';
import type { CreateInquiryDto } from './dto/create-inquiry.dto.js';
import { InquiriesRepository } from './inquiries.repository.js';
import { InquiryNotifier } from './inquiry-notifier.js';

export interface SubmissionAck {
  message: string;
}

const ACK: SubmissionAck = { message: 'Thanks! We usually reply within 1 business day.' };
const MIN_FILL_MS = 3_000;
const DUPLICATE_WINDOW_MS = 10 * 60_000;

@Injectable()
export class InquirySubmissionService {
  constructor(
    private readonly repository: InquiriesRepository,
    private readonly notifier: InquiryNotifier,
  ) {}

  async submit(dto: CreateInquiryDto): Promise<SubmissionAck> {
    const now = Date.now();
    if (this.looksAutomated(dto, now) || (await this.isDuplicate(dto, now))) {
      return ACK;
    }

    const inquiry = await this.repository.create({
      type: dto.type,
      name: dto.name,
      email: dto.email,
      subject: dto.subject ?? null,
      message: dto.message,
      company: dto.company ?? null,
      phone: dto.phone ?? null,
      serviceInterest: dto.serviceInterest ?? null,
      budgetRange: dto.budgetRange ?? null,
      timeline: dto.timeline ?? null,
      source: dto.source ?? InquirySource.WEB,
      sourcePage: dto.sourcePage ?? null,
    });
    this.notifier.notifyAdmins(inquiry);
    return ACK;
  }

  private looksAutomated({ website, renderedAt }: CreateInquiryDto, now: number): boolean {
    const filledHoneypot = Boolean(website?.trim());
    const tooFast = renderedAt !== undefined && now - renderedAt >= 0 && now - renderedAt < MIN_FILL_MS;
    return filledHoneypot || tooFast;
  }

  private isDuplicate({ email, message }: CreateInquiryDto, now: number): Promise<boolean> {
    return this.repository.existsSince(email, message, new Date(now - DUPLICATE_WINDOW_MS));
  }
}
