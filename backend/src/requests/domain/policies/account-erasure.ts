import { LastAdminCannotBeDeletedError } from '../errors/last-admin-cannot-be-deleted.error';
export function assertCanEraseAccount(
  role: string,
  activeAdmins: number,
): void {
  if (role === 'ADMIN' && activeAdmins <= 1)
    throw new LastAdminCannotBeDeletedError();
}
