export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Delivery mechanism behind MailService. Implementations are selected by MAIL_TRANSPORT. */
export interface MailTransport {
  send(message: MailMessage & { from: string }): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
