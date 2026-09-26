import { createTransport, type Transporter } from 'nodemailer';

import type { MailConfig } from '../../../config/mail.config';
import type { MailMessage, MailTransport } from '../mail.types';

const SMTP_TIMEOUT_MS = 10_000;

export class SmtpMailTransport implements MailTransport {
  private readonly transporter: Transporter;

  constructor(config: MailConfig['smtp']) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });
  }

  async send(message: MailMessage & { from: string }): Promise<void> {
    await this.transporter.sendMail(message);
  }
}
