import { ROUTES } from '../../routes';
import type { UserRole } from './session';

/** First screen each role sees after signing in. */
export const HOME_BY_ROLE: Record<UserRole, string> = {
  PUBLICO: ROUTES.materials,
  PERSONAL: ROUTES.requests,
  ADMIN: ROUTES.requests,
};
