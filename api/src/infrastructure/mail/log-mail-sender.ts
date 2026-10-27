import { Logger } from '@nestjs/common';
import { MailMessage, MailSender } from './mail-sender.js';

export class LogMailSender extends MailSender {
  private readonly logger = new Logger(LogMailSender.name);

  async send({ to, subject, text }: MailMessage): Promise<void> {
    this.logger.log(`SMTP is not configured, mail not sent. To: ${[to].flat().join(', ')} | ${subject}\n${text}`);
  }
}
