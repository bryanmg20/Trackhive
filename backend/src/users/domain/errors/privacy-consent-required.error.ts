import { DomainError } from '../../../common/errors/domain.error';

export class PrivacyConsentRequiredError extends DomainError {
  readonly code = 'PRIVACY_CONSENT_REQUIRED';

  constructor() {
    super('Debe aceptar el aviso de privacidad vigente para crear la cuenta');
  }
}
