import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { MailMessage, MailSender } from './mail-sender.js';

const SMTPS_PORT = 465;
const TIMEOUT_MS = 10_000;

export interface SmtpOptions {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}

export class SmtpMailSender extends MailSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor({ host, port, user, password, from }: SmtpOptions) {
    super();
    this.from = from;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === SMTPS_PORT,
      auth: user ? { user, pass: password } : undefined,
      connectionTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
