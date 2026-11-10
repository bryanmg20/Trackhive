import { DomainError } from '../../../common/errors/domain.error';

/** The mail server rejected the email, could not be reached or is not configured. */
export class MailDeliveryFailedError extends DomainError {
  readonly code = 'MAIL_DELIVERY_FAILED';

  /**
   * @param detail What the mail server answered, without email addresses.
   * It is kept with the pending email (HU-23); the HTTP answer never shows it.
   */
  constructor(readonly detail?: string) {
    super('No se pudo enviar el correo. Revisa la configuración SMTP');
  }
}
