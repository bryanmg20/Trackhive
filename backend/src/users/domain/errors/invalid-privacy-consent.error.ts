import { DomainError } from '../../../common/errors/domain.error';

export class InvalidPrivacyConsentError extends DomainError {
  readonly code = 'INVALID_PRIVACY_CONSENT';

  constructor() {
    super('El consentimiento debe incluir la fecha y la versión del aviso');
  }
}
