import { User, UserProps } from './user.entity';
import { InvalidEmailError } from '../errors/invalid-email.error';
import { InvalidFullNameError } from '../errors/invalid-full-name.error';
import { InvalidPasswordHashError } from '../errors/invalid-password-hash.error';
import { InvalidRoleError } from '../errors/invalid-role.error';
import { UserRole } from '../user-role';

const validProps = (): UserProps => ({
  id: '1',
  fullName: 'Ana Pérez',
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

  it('normalizes the email and trims the full name', () => {
    const user = new User({
      ...validProps(),
      fullName: '  Ana Pérez  ',
      email: '  ANA@MAIL.COM ',
    });

    expect(user.fullName).toBe('Ana Pérez');
    expect(user.email).toBe('ana@mail.com');
  });

  it('throws InvalidEmailError when the email is invalid', () => {
    expect(() => new User({ ...validProps(), email: 'not-an-email' })).toThrow(
      InvalidEmailError,
    );
  });

  it('throws InvalidFullNameError when the full name is empty', () => {
    expect(() => new User({ ...validProps(), fullName: '   ' })).toThrow(
      InvalidFullNameError,
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
});
