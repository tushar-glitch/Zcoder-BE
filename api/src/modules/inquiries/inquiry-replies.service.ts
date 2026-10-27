import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { withTimeout } from '../../common/timeout.js';
import { InquiryStatus } from '../../generated/prisma/client.js';
import { MailSender } from '../../infrastructure/mail/mail-sender.js';
import type { SendReplyDto } from './dto/inquiry-admin.dto.js';
import { InquiriesRepository, ReplyRow } from './inquiries.repository.js';
import { ReplyOutcome, toReplyResponse } from './inquiry.presenter.js';

export const MAX_REPLY_ATTEMPTS = 3;
const SEND_TIMEOUT_MS = 10_000;
const MAX_ERROR_LENGTH = 300;

interface Recipient {
  id: string;
  email: string;
  status: InquiryStatus;
}

@Injectable()
export class InquiryRepliesService {
  constructor(
    private readonly repository: InquiriesRepository,
    private readonly mail: MailSender,
  ) {}

  async send(inquiryId: string, adminId: string, dto: SendReplyDto): Promise<ReplyOutcome> {
    const inquiry = await this.findRecipient(inquiryId);
    const reply = await this.repository.createReply({ inquiryId, subject: dto.subject, body: dto.body, sentById: adminId });
    return this.deliver(inquiry, reply);
  }

  async retry(inquiryId: string, replyId: string): Promise<ReplyOutcome> {
    const inquiry = await this.findRecipient(inquiryId);
    const reply = await this.repository.findReply(inquiryId, replyId);
    if (!reply) {
      throw new NotFoundException('Reply not found');
    }
    if (!(await this.repository.claimRetry(replyId, MAX_REPLY_ATTEMPTS))) {
      throw new ConflictException(`Only a failed reply with fewer than ${MAX_REPLY_ATTEMPTS} attempts can be retried`);
    }
    return this.deliver(inquiry, reply);
  }

  private async findRecipient(inquiryId: string): Promise<Recipient> {
    const inquiry = await this.repository.findById(inquiryId);
    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }
    return inquiry;
  }

  private async deliver(inquiry: Recipient, reply: ReplyRow): Promise<ReplyOutcome> {
    try {
      await withTimeout(
        this.mail.send({ to: inquiry.email, subject: reply.subject, text: reply.body }),
        SEND_TIMEOUT_MS,
        'The email provider did not respond in time',
      );
    } catch (error) {
      const failed = await this.repository.markReplyFailed(reply.id, this.describe(error));
      return { reply: toReplyResponse(failed), inquiryStatus: inquiry.status };
    }

    const sent = await this.repository.markReplySent(inquiry.id, reply.id, new Date());
    return { reply: toReplyResponse(sent), inquiryStatus: InquiryStatus.REPLIED };
  }

  private describe(error: unknown): string {
    const message = error instanceof Error && error.message ? error.message : 'Email delivery failed';
    return message.slice(0, MAX_ERROR_LENGTH);
  }
}
