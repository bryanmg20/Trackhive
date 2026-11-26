import { canViewDigitalCopyDetails } from './material-digital-copy-visibility';

describe('canViewDigitalCopyDetails (HU-140)', () => {
  it('allows PERSONAL and ADMIN to view folder name and review status', () => {
    expect(canViewDigitalCopyDetails('PERSONAL')).toBe(true);
    expect(canViewDigitalCopyDetails('ADMIN')).toBe(true);
  });

  it('hides folder name and review status from PUBLICO', () => {
    expect(canViewDigitalCopyDetails('PUBLICO')).toBe(false);
  });
});
