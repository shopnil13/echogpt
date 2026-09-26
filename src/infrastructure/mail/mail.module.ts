import { Module } from '@nestjs/common';

import { mailConfig, type MailConfig } from '../../config/mail.config';
import { MAIL_TRANSPORT, type MailTransport } from './mail.types';
import { MailService } from './mail.service';
import { LogMailTransport } from './transports/log-mail.transport';
import { SmtpMailTransport } from './transports/smtp-mail.transport';

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [mailConfig.KEY],
      useFactory: (config: MailConfig): MailTransport =>
        config.transport === 'smtp' ? new SmtpMailTransport(config.smtp) : new LogMailTransport(),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
