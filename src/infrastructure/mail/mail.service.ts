import { Inject, Injectable, Logger } from '@nestjs/common';

import { mailConfig, type MailConfig } from '../../config/mail.config';
import { MAIL_TRANSPORT, type MailMessage, type MailTransport } from './mail.types';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    @Inject(mailConfig.KEY) private readonly config: MailConfig,
  ) {}

  /** Sends an email. Failures are thrown; callers decide whether they are fatal. */
  async send(message: MailMessage): Promise<void> {
    await this.transport.send({ ...message, from: this.config.from });
    this.logger.debug({ to: message.to, subject: message.subject }, 'Email sent');
  }
}
