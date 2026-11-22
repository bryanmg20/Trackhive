import { DomainError } from '../../../common/errors/domain.error';

/**
 * The configuration of the folder convention (HU-136) is wrong: a bad
 * pattern, a template with an unknown group, an unknown material type…
 */
export class InvalidCatalogConventionError extends DomainError {
  readonly code = 'INVALID_CATALOG_CONVENTION';

  constructor(readonly reason: string) {
    super(`Convención de carpetas inválida: ${reason}`);
  }
}
