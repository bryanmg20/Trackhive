import { DomainError } from '../../../common/errors/domain.error';
import { REQUEST_STATUS_LABELS, RequestStatus } from '../request-status';

export class InvalidStatusTransitionError extends DomainError {
  readonly code = 'INVALID_STATUS_TRANSITION';

  constructor(from: RequestStatus, to: RequestStatus) {
    super(
      `No se puede pasar una solicitud de ${REQUEST_STATUS_LABELS[from]} a ${REQUEST_STATUS_LABELS[to]}`,
    );
  }
}
