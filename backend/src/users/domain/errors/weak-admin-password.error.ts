import { DomainError } from '../../../common/errors/domain.error';
import { MIN_PRODUCTION_ADMIN_PASSWORD_LENGTH } from '../policies/initial-admin-password';

/** ADMIN_PASSWORD is too short for production (RUN_SEED=false, HU-42). */
export class WeakAdminPasswordError extends DomainError {
  readonly code = 'WEAK_ADMIN_PASSWORD';

  constructor() {
    super(
      `ADMIN_PASSWORD debe tener al menos ${MIN_PRODUCTION_ADMIN_PASSWORD_LENGTH} caracteres en producción (RUN_SEED=false)`,
    );
  }
}
