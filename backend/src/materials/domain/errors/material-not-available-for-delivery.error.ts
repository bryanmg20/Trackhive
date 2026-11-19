import { DomainError } from '../../../common/errors/domain.error';

const STATUS_PHRASES: Record<string, string> = {
  EN_RESTAURACION: 'está en restauración',
  NO_CONSULTABLE: 'no es consultable',
};

export class MaterialNotAvailableForDeliveryError extends DomainError {
  readonly code = 'MATERIAL_NOT_AVAILABLE';

  constructor(status?: string) {
    const phrase = status ? STATUS_PHRASES[status] : undefined;
    super(
      phrase
        ? `El material ${phrase} y no puede entregarse en sala.`
        : 'El material no está disponible para entrega en sala.',
    );
  }
}
