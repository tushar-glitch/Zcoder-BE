export interface MailMessage {
  to: string | string[];
  subject: string;
  text: string;
}

export abstract class MailSender {
  abstract send(message: MailMessage): Promise<void>;
}
