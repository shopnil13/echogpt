import { Logger } from '@nestjs/common';

import type { MailMessage, MailTransport } from '../mail.types';

/**
 * Development transport: writes the email to the log instead of sending it, so verification
 * links can be followed locally. Never use it in production: the body may contain one-time tokens.
 */
export class LogMailTransport implements MailTransport {
  private readonly logger = new Logger(LogMailTransport.name);

  send(message: MailMessage & { from: string }): Promise<void> {
    this.logger.log(
      { to: message.to, subject: message.subject, body: message.text },
      'Email (log transport)',
    );
    return Promise.resolve();
  }
}
