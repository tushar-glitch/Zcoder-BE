import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment.js';
import { LogMailSender } from './log-mail-sender.js';
import { MailSender } from './mail-sender.js';
import { SmtpMailSender } from './smtp-mail-sender.js';

@Global()
@Module({
  providers: [
    {
      provide: MailSender,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>): MailSender => {
        const host = config.get('SMTP_HOST', { infer: true });
        if (!host) {
          return new LogMailSender();
        }
        return new SmtpMailSender({
          host,
          port: config.get('SMTP_PORT', { infer: true }),
          user: config.get('SMTP_USER', { infer: true }),
          password: config.get('SMTP_PASSWORD', { infer: true }),
          from: config.get('MAIL_FROM', { infer: true }),
        });
      },
    },
  ],
  exports: [MailSender],
})
export class MailModule {}
