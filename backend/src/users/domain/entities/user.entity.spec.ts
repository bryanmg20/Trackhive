import {
  NewStaffUserProps,
  StaffAccountChanges,
  User,
  UserProps,
} from './user.entity';
import { CannotChangeOwnAccessError } from '../errors/cannot-change-own-access.error';
import { InvalidEmailError } from '../errors/invalid-email.error';
import { InvalidNameError } from '../errors/invalid-name.error';
import { InvalidPasswordHashError } from '../errors/invalid-password-hash.error';
import { InvalidPrivacyConsentError } from '../errors/invalid-privacy-consent.error';
import { InvalidRoleError } from '../errors/invalid-role.error';
import { InvalidStaffRoleError } from '../errors/invalid-staff-role.error';
import { UserRole } from '../enums/user-role';

const validProps = (): UserProps => ({
  id: '1',
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@mail.com',
  passwordHash: '$argon2id$hash',
  role: 'PUBLICO',
  active: true,
});

describe('User', () => {
  it('creates a user with valid account data', () => {
    const user = new User(validProps());

    expect(user.email).toBe('ana@mail.com');
    expect(user.role).toBe('PUBLICO');
  });

  it('normalizes the email and trims the four name fields', () => {
    const user = new User({
      ...validProps(),
      firstName: '  Ana ',
      middleName: ' María ',
      lastName: ' Pérez ',
      secondLastName: '  Gómez  ',
      email: '  ANA@MAIL.COM ',
    });

    expect(user.firstName).toBe('Ana');
    expect(user.middleName).toBe('María');
    expect(user.lastName).toBe('Pérez');
    expect(user.secondLastName).toBe('Gómez');
    expect(user.email).toBe('ana@mail.com');
  });

  it('accepts only the required name fields and leaves the optional ones null', () => {
    const user = new User(validProps());

    expect(user.firstName).toBe('Ana');
    expect(user.middleName).toBeNull();
    expect(user.lastName).toBe('Pérez');
    expect(user.secondLastName).toBeNull();
  });

  it('turns blank optional name fields into null', () => {
    const user = new User({
      ...validProps(),
      middleName: '   ',
      secondLastName: '',
    });

    expect(user.middleName).toBeNull();
    expect(user.secondLastName).toBeNull();
  });

  it.each(['firstName', 'lastName'] as const)(
    'throws InvalidNameError when %s is blank',
    (field) => {
      expect(() => new User({ ...validProps(), [field]: '   ' })).toThrow(
        InvalidNameError,
      );
    },
  );

  it.each(['firstName', 'middleName', 'lastName', 'secondLastName'] as const)(
    'throws InvalidNameError when %s has more than 40 characters',
    (field) => {
      expect(
        () => new User({ ...validProps(), [field]: 'a'.repeat(41) }),
      ).toThrow(InvalidNameError);
    },
  );

  it('accepts name fields of exactly 40 characters', () => {
    const name = 'a'.repeat(40);
    const user = new User({
      ...validProps(),
      firstName: name,
      middleName: name,
      lastName: name,
      secondLastName: name,
    });

    expect(user.secondLastName).toBe(name);
  });

  it('says which name field is invalid', () => {
    expect(() => new User({ ...validProps(), lastName: '' })).toThrow(
      'El primer apellido es obligatorio',
    );
  });

  it('throws InvalidEmailError when the email is invalid', () => {
    expect(() => new User({ ...validProps(), email: 'not-an-email' })).toThrow(
      InvalidEmailError,
    );
  });

  it('throws InvalidPasswordHashError when the hash is empty', () => {
    expect(() => new User({ ...validProps(), passwordHash: '' })).toThrow(
      InvalidPasswordHashError,
    );
  });

  it('throws InvalidRoleError when the role is unknown', () => {
    expect(
      () => new User({ ...validProps(), role: 'ROOT' as UserRole }),
    ).toThrow(InvalidRoleError);
  });

  it('does not accept a whitespace-only hash', () => {
    expect(() => new User({ ...validProps(), passwordHash: '   ' })).toThrow(
      InvalidPasswordHashError,
    );
  });

  it('stores the privacy consent date and version together', () => {
    const acceptedAt = new Date('2026-11-10T12:00:00Z');
    const user = new User({
      ...validProps(),
      privacyPolicyAcceptedAt: acceptedAt,
      privacyPolicyVersion: ' 1.0 ',
    });

    expect(user.privacyPolicyAcceptedAt).toEqual(acceptedAt);
    expect(user.privacyPolicyVersion).toBe('1.0');
  });

  it('rejects a consent record with only the date or only the version', () => {
    expect(
      () =>
        new User({
          ...validProps(),
          privacyPolicyAcceptedAt: new Date(),
        }),
    ).toThrow(InvalidPrivacyConsentError);

    expect(
      () =>
        new User({
          ...validProps(),
          privacyPolicyVersion: '1.0',
        }),
    ).toThrow(InvalidPrivacyConsentError);
  });
});

describe('User staff accounts (HU-05)', () => {
  const ADMIN_ID = 'admin-1';

  const newStaff = (overrides: Partial<NewStaffUserProps> = {}) =>
    User.createStaff({
      id: 'staff-1',
      firstName: 'Laura',
      lastName: 'Gómez',
      email: 'laura@clena.org',
      passwordHash: '$argon2id$hash',
      ...overrides,
    });

  const adminAccount = (id: string) =>
    new User({ ...validProps(), id, role: 'ADMIN' });

  describe('createStaff', () => {
    it('creates an active PERSONAL account without a privacy consent', () => {
      const user = newStaff({ email: '  LAURA@CLENA.ORG ' });

      expect(user.role).toBe('PERSONAL');
      expect(user.active).toBe(true);
      expect(user.isStaff()).toBe(true);
      expect(user.email).toBe('laura@clena.org');
      expect(user.privacyPolicyAcceptedAt).toBeNull();
      expect(user.privacyPolicyVersion).toBeNull();
    });

    it('always creates PERSONAL, even if a role is slipped in', () => {
      const user = newStaff({ role: 'ADMIN' } as Partial<NewStaffUserProps>);

      expect(user.role).toBe('PERSONAL');
    });

    it('validates the names and the email like any account', () => {
      expect(() => newStaff({ firstName: ' ' })).toThrow(InvalidNameError);
      expect(() => newStaff({ email: 'no-es-correo' })).toThrow(
        InvalidEmailError,
      );
    });
  });

  describe('isStaff', () => {
    it('is false for a public account', () => {
      expect(new User(validProps()).isStaff()).toBe(false);
    });
  });

  describe('updateStaffAccount', () => {
    it('changes the names and email that are sent, never the role', () => {
      const user = newStaff({ middleName: 'Sofía' });

      const updated = user.updateStaffAccount(
        {
          firstName: ' Laura ',
          middleName: null,
          lastName: 'Gómez',
          secondLastName: 'Ríos',
          email: 'LAURA.GOMEZ@clena.org',
        },
        ADMIN_ID,
      );

      expect(updated).toMatchObject({
        id: 'staff-1',
        firstName: 'Laura',
        middleName: null,
        secondLastName: 'Ríos',
        email: 'laura.gomez@clena.org',
        role: 'PERSONAL',
        active: true,
        passwordHash: '$argon2id$hash',
      });
    });

    it('ignores a role slipped into the changes: PERSONAL is never promoted', () => {
      const updated = newStaff().updateStaffAccount(
        { role: 'ADMIN' } as StaffAccountChanges,
        ADMIN_ID,
      );

      expect(updated.role).toBe('PERSONAL');
    });

    it('keeps every field that is not sent', () => {
      const user = newStaff({ middleName: 'Sofía', secondLastName: 'Ríos' });

      const updated = user.updateStaffAccount({}, ADMIN_ID);

      expect(updated).toEqual(user);
    });

    it('deactivates and reactivates another account without changing the original', () => {
      const user = newStaff();

      const deactivated = user.updateStaffAccount({ active: false }, ADMIN_ID);
      const reactivated = deactivated.updateStaffAccount(
        { active: true },
        ADMIN_ID,
      );

      expect(deactivated.active).toBe(false);
      expect(reactivated.active).toBe(true);
      // The entity is immutable: the change returns a copy
      expect(user.active).toBe(true);
    });

    it('does not manage a public account', () => {
      const publicUser = new User(validProps());

      expect(() =>
        publicUser.updateStaffAccount({ active: false }, ADMIN_ID),
      ).toThrow(InvalidStaffRoleError);
    });

    it('does not let an administrator deactivate their own account', () => {
      expect(() =>
        adminAccount(ADMIN_ID).updateStaffAccount({ active: false }, ADMIN_ID),
      ).toThrow(CannotChangeOwnAccessError);
    });

    it('lets an administrator edit their own names and email', () => {
      const updated = adminAccount(ADMIN_ID).updateStaffAccount(
        { firstName: 'Lucía', email: 'lucia@clena.org', active: true },
        ADMIN_ID,
      );

      expect(updated).toMatchObject({
        firstName: 'Lucía',
        email: 'lucia@clena.org',
        role: 'ADMIN',
        active: true,
      });
    });

    it('rejects a required name sent empty and an invalid email', () => {
      const user = newStaff();

      expect(() =>
        user.updateStaffAccount(
          { lastName: null as unknown as string },
          ADMIN_ID,
        ),
      ).toThrow('El primer apellido es obligatorio');
      expect(() =>
        user.updateStaffAccount({ email: 'sin-arroba' }, ADMIN_ID),
      ).toThrow(InvalidEmailError);
    });
  });
});
