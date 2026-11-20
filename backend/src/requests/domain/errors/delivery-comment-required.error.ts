import { DomainError } from '../../../common/errors/domain.error';

/**
 * A request EN_BUSQUEDA with written references without material becomes
 * DISPONIBLE only with a comment that says what is delivered and how
 * (HU-09.2): it stays in the history and the requester reads it.
 */
export class DeliveryCommentRequiredError extends DomainError {
  readonly code = 'DELIVERY_COMMENT_REQUIRED';

  constructor() {
    super(
      'La solicitud tiene referencias sin material asociado: escriba en el comentario qué se entrega y cómo (por ejemplo «localizada en físico, se consulta en sala»).',
    );
  }
}
