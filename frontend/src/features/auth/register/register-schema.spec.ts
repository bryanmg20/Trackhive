import { describe, expect, it } from 'vitest';
import { registerSchema } from './register-schema';

const validValues = {
  firstName: 'Ana',
  middleName: '',
  lastName: 'Pérez',
  secondLastName: '',
  email: 'ana@mail.com',
  password: 'secret123',
  confirmPassword: 'secret123',
  acceptedPrivacy: true,
};

describe('registerSchema', () => {
  it('accepts a complete registration', () => {
    expect(registerSchema.safeParse(validValues).success).toBe(true);
  });

  it('accepts the four name fields', () => {
    const result = registerSchema.safeParse({
      ...validValues,
      middleName: 'María',
      secondLastName: 'Gómez',
    });

    expect(result.success).toBe(true);
  });

  it('requires every mandatory field and leaves the optional names blank', () => {
    const result = registerSchema.safeParse({
      firstName: '',
      middleName: '',
      lastName: '',
      secondLastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptedPrivacy: false,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path[0]);
      expect(fields).toEqual(
        expect.arrayContaining([
          'firstName',
          'lastName',
          'email',
          'password',
          'confirmPassword',
          'acceptedPrivacy',
        ]),
      );
      expect(fields).not.toContain('middleName');
      expect(fields).not.toContain('secondLastName');
    }
  });

  it('treats a first name or last name with only spaces as missing', () => {
    const result = registerSchema.safeParse({
      ...validValues,
      firstName: '   ',
      lastName: '   ',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toEqual(
        expect.arrayContaining([
          'Escriba su primer nombre.',
          'Escriba su primer apellido.',
        ]),
      );
    }
  });

  it.each([
    ['firstName', 'El primer nombre'],
    ['middleName', 'El segundo nombre'],
    ['lastName', 'El primer apellido'],
    ['secondLastName', 'El segundo apellido'],
  ])('rejects %s longer than 40 characters', (field, label) => {
    const result = registerSchema.safeParse({
      ...validValues,
      [field]: 'a'.repeat(41),
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({
          path: [field],
          message: `${label} no puede superar los 40 caracteres.`,
        }),
      ]);
    }
  });

  it('accepts name fields of exactly 40 characters', () => {
    const name = 'a'.repeat(40);
    const result = registerSchema.safeParse({
      ...validValues,
      firstName: name,
      middleName: name,
      lastName: name,
      secondLastName: name,
    });

    expect(result.success).toBe(true);
  });

  it('requires accepting the privacy notice', () => {
    const result = registerSchema.safeParse({
      ...validValues,
      acceptedPrivacy: false,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path[0] === 'acceptedPrivacy' &&
            issue.message ===
              'Debe aceptar el aviso de privacidad para crear su cuenta.',
        ),
      ).toBe(true);
    }
  });

  it('rejects an invalid email address', () => {
    const result = registerSchema.safeParse({
      ...validValues,
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'email')).toBe(
        true,
      );
    }
  });

  it('requires a password with at least eight characters', () => {
    const result = registerSchema.safeParse({
      ...validValues,
      password: 'short',
      confirmPassword: 'short',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.path[0] === 'password' && issue.message === 'Use al menos 8 caracteres.',
        ),
      ).toBe(true);
    }
  });

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      ...validValues,
      confirmPassword: 'different123',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path[0] === 'confirmPassword' &&
            issue.message === 'Las contraseñas no coinciden.',
        ),
      ).toBe(true);
    }
  });

  it('trims the names and email before returning the values', () => {
    const result = registerSchema.safeParse({
      ...validValues,
      firstName: '  Ana ',
      middleName: '   ',
      lastName: ' Pérez  ',
      secondLastName: '  Gómez ',
      email: '  ana@mail.com  ',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.firstName).toBe('Ana');
      expect(result.data.middleName).toBe('');
      expect(result.data.lastName).toBe('Pérez');
      expect(result.data.secondLastName).toBe('Gómez');
      expect(result.data.email).toBe('ana@mail.com');
    }
  });
});
