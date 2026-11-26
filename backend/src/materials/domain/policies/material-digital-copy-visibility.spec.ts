import type { UserRole } from '../../../users/domain/enums/user-role';
import { canViewDigitalCopyDetails } from './material-digital-copy-visibility';

describe('canViewDigitalCopyDetails (HU-140)', () => {
  it('allows PERSONAL and ADMIN to view folder name and review status', () => {
    expect(canViewDigitalCopyDetails('PERSONAL')).toBe(true);
    expect(canViewDigitalCopyDetails('ADMIN')).toBe(true);
  });

  it('hides folder name and review status from PUBLICO and unlisted roles', () => {
    expect(canViewDigitalCopyDetails('PUBLICO')).toBe(false);
    expect(canViewDigitalCopyDetails('INVITADO' as UserRole)).toBe(false);
  });
});
