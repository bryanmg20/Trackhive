import { assertCanEraseAccount } from './account-erasure';
import { LastAdminCannotBeDeletedError } from '../errors/last-admin-cannot-be-deleted.error';
describe('account erasure admin availability', () => {
  it.each([0, 1])('rejects ADMIN erasure with %s active admins', (count) => {
    expect(() => assertCanEraseAccount('ADMIN', count)).toThrow(
      LastAdminCannotBeDeletedError,
    );
  });
  it('allows ADMIN erasure when another remains', () => {
    expect(() => assertCanEraseAccount('ADMIN', 2)).not.toThrow();
  });
  it.each(['PUBLICO', 'PERSONAL'])(
    'does not restrict %s by admin count',
    (role) => {
      expect(() => assertCanEraseAccount(role, 0)).not.toThrow();
    },
  );
});
