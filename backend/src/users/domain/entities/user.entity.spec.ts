import { User, UserProps } from './user.entity';
import { InvalidEmailError } from '../errors/invalid-email.error';
import { InvalidNameError } from '../errors/invalid-name.error';
import { InvalidPasswordHashError } from '../errors/invalid-password-hash.error';
import { InvalidRoleError } from '../errors/invalid-role.error';
import { UserRole } from '../user-role';

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
});
