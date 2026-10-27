import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment.js';
import { Inquiry, InquiryType } from '../../generated/prisma/client.js';
import { MailSender } from '../../infrastructure/mail/mail-sender.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class InquiryNotifier {
  constructor(
    private readonly mail: MailSender,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  notifyAdmins(inquiry: Inquiry): void {
    const recipients = this.recipients();
    if (recipients.length === 0) {
      return;
    }

    void this.mail
      .send({ to: recipients, subject: this.subjectOf(inquiry), text: this.bodyOf(inquiry) })
      .catch((error: unknown) =>
        this.audit.record({
          adminId: null,
          action: 'notification.failed',
          entityType: 'inquiry',
          entityId: inquiry.id,
          metadata: { reason: error instanceof Error ? error.message : 'Unknown mail error' },
        }),
      );
  }

  private recipients(): string[] {
    const raw = this.config.get('ADMIN_NOTIFY_EMAIL', { infer: true }) ?? '';
    return raw
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean);
  }

  private subjectOf({ type, name }: Inquiry): string {
    return `New ${type === InquiryType.PROJECT ? 'project inquiry' : 'contact message'} from ${name}`;
  }

  private bodyOf(inquiry: Inquiry): string {
    const link = new URL(`/admin/inquiries/${inquiry.id}`, this.config.get('APP_URL', { infer: true }));
    const topic = inquiry.type === InquiryType.PROJECT ? inquiry.serviceInterest : inquiry.subject;
    return [
      `Type: ${inquiry.type}`,
      `Name: ${inquiry.name}`,
      `Email: ${inquiry.email}`,
      `${inquiry.type === InquiryType.PROJECT ? 'Service of interest' : 'Subject'}: ${topic ?? '-'}`,
      '',
      `Read and reply: ${link.toString()}`,
    ].join('\n');
  }
}
