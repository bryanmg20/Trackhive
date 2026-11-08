import { DomainError } from '../../../common/errors/domain.error';

/** The mail server rejected the email, could not be reached or is not configured. */
export class MailDeliveryFailedError extends DomainError {
  readonly code = 'MAIL_DELIVERY_FAILED';

  constructor() {
    super('No se pudo enviar el correo. Revisa la configuración SMTP');
  }
}
