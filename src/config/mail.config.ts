import { registerAs } from '@nestjs/config';

import { envBool, envInt, envOptionalString, envString } from './env.utils';

export type MailTransportKind = 'log' | 'smtp';

export const mailConfig = registerAs('mail', () => ({
  transport: envString('MAIL_TRANSPORT') as MailTransportKind,
  from: envString('MAIL_FROM'),
  smtp: {
    host: envOptionalString('SMTP_HOST'),
    port: envInt('SMTP_PORT'),
    secure: envBool('SMTP_SECURE'),
    user: envOptionalString('SMTP_USER'),
    pass: envOptionalString('SMTP_PASS'),
  },
}));

export type MailConfig = ReturnType<typeof mailConfig>;
