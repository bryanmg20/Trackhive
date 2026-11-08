import { describe, expect, it } from 'vitest';
import { registerSchema } from './register-schema';

const validValues = {
  fullName: 'Ana Pérez',
  email: 'ana@mail.com',
  password: 'secret123',
  confirmPassword: 'secret123',
  acceptedPrivacy: true,
};

describe('registerSchema', () => {
  it('accepts a complete registration', () => {
    expect(registerSchema.safeParse(validValues).success).toBe(true);
  });

  it('requires every field', () => {
    const result = registerSchema.safeParse({
      fullName: '',
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
          'fullName',
          'email',
          'password',
          'confirmPassword',
          'acceptedPrivacy',
        ]),
      );
    }
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

  it('trims the name and email before returning the values', () => {
    const result = registerSchema.safeParse({
      ...validValues,
      fullName: '  Ana Pérez  ',
      email: '  ana@mail.com  ',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.fullName).toBe('Ana Pérez');
      expect(result.data.email).toBe('ana@mail.com');
    }
  });
});
