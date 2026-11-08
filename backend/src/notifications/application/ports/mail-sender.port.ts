export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends emails without the use cases knowing the provider (D-10).
 * The SMTP implementation lives in infrastructure; tests use a fake.
 */
export interface MailSender {
  /** Throws MailDeliveryFailedError if the email could not be sent. */
  send(message: MailMessage): Promise<void>;
}
