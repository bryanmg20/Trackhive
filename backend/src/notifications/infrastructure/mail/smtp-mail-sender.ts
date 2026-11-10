import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { MailDeliveryFailedError } from '../../domain/errors/mail-delivery-failed.error';
import type {
  MailMessage,
  MailSender,
} from '../../application/ports/mail-sender.port';

// Nodemailer waits up to 2 minutes by default; a request should not hang that long
const CONNECTION_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;
const SMTPS_PORT = 465;

/**
 * MailSender over SMTP with Nodemailer (D-10). Every value comes from the
 * SMTP_* variables of the .env. In development they point to Mailpit,
 * which keeps the emails without sending them.
 */
@Injectable()
export class SmtpMailSender implements MailSender {
  private readonly logger = new Logger(SmtpMailSender.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  async send(message: MailMessage): Promise<void> {
    try {
      await this.getTransporter().sendMail({
        from: this.config.getOrThrow<string>('SMTP_FROM'),
        ...message,
      });
    } catch (error) {
      // The recipient is personal data, so it stays out of the logs (D-23).
      // Some SMTP answers repeat it, such as «550 <ana@...>: user unknown»
      const detail = withoutEmails(
        error instanceof Error ? error.message : String(error),
      );
      this.logger.error(`Could not send email: ${detail}`);
      throw new MailDeliveryFailedError(detail);
    }
  }

  // Built on the first email and reused, like JwtTokenService reads its secrets
  private getTransporter(): Transporter {
    if (!this.transporter) {
      const port = Number(this.config.getOrThrow<string>('SMTP_PORT'));
      const user = this.config.get<string>('SMTP_USER');
      this.transporter = createTransport({
        host: this.config.getOrThrow<string>('SMTP_HOST'),
        port,
        // Port 465 uses TLS from the start; the others upgrade with STARTTLS
        secure: port === SMTPS_PORT,
        // Mailpit needs no login, so credentials are optional
        ...(user
          ? { auth: { user, pass: this.config.get<string>('SMTP_PASSWORD') } }
          : {}),
        connectionTimeout: CONNECTION_TIMEOUT_MS,
        greetingTimeout: CONNECTION_TIMEOUT_MS,
        socketTimeout: SOCKET_TIMEOUT_MS,
      });
    }
    return this.transporter;
  }
}

function withoutEmails(text: string): string {
  return text.replace(/[^\s<>()[\]",;:@]+@[^\s<>()[\]",;:@]+/g, '[correo]');
}
