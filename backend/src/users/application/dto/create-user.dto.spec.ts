import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

const validDto = (overrides: Partial<CreateUserDto> = {}): CreateUserDto =>
  Object.assign(new CreateUserDto(), {
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@mail.com',
    password: 'secreto123',
    acceptedPrivacy: true,
    privacyPolicyVersion: '1.0',
    ...overrides,
  });

describe('CreateUserDto', () => {
  it('accepts a registration with the current privacy consent', async () => {
    await expect(validate(validDto())).resolves.toEqual([]);
  });

  it('rejects a registration that does not accept the privacy notice', async () => {
    const errors = await validate(validDto({ acceptedPrivacy: false }));

    expect(
      errors.find((error) => error.property === 'acceptedPrivacy'),
    ).toBeDefined();
  });

  it('rejects a registration without the acceptance flag', async () => {
    const errors = await validate(validDto({ acceptedPrivacy: undefined }));

    expect(
      errors.find((error) => error.property === 'acceptedPrivacy'),
    ).toBeDefined();
  });

  it('rejects an outdated privacy notice version', async () => {
    const errors = await validate(validDto({ privacyPolicyVersion: '0.9' }));

    expect(
      errors.find((error) => error.property === 'privacyPolicyVersion'),
    ).toBeDefined();
  });
});

describe('CreateUserDto transforms', () => {
  const fromBody = (overrides: Record<string, unknown> = {}) =>
    plainToInstance(CreateUserDto, {
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@mail.com',
      password: 'secreto123',
      acceptedPrivacy: true,
      privacyPolicyVersion: '1.0',
      ...overrides,
    });

  it('trims the required names and the privacy notice version', async () => {
    const dto = fromBody({
      firstName: '  Ana ',
      lastName: ' Pérez  ',
      privacyPolicyVersion: ' 1.0 ',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.firstName).toBe('Ana');
    expect(dto.lastName).toBe('Pérez');
    expect(dto.privacyPolicyVersion).toBe('1.0');
  });

  it('rejects a required name sent blank', async () => {
    const errors = await validate(fromBody({ firstName: '   ' }));

    expect(errors.map((error) => error.property)).toContain('firstName');
  });

  it('stores a blank optional name as null', async () => {
    const dto = fromBody({ middleName: '   ', secondLastName: '' });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.middleName).toBeNull();
    expect(dto.secondLastName).toBeNull();
  });

  it('trims an optional name that has text', () => {
    const dto = fromBody({ middleName: ' María ', secondLastName: ' Gómez ' });

    expect(dto.middleName).toBe('María');
    expect(dto.secondLastName).toBe('Gómez');
  });

  it('rejects an optional name that is not text', async () => {
    const errors = await validate(fromBody({ middleName: 42 }));

    expect(errors.map((error) => error.property)).toContain('middleName');
  });

  it('normalizes the email to lowercase without spaces', () => {
    const dto = fromBody({ email: '  Ana@Mail.COM ' });

    expect(dto.email).toBe('ana@mail.com');
  });

  it('rejects a required text field that is not text', async () => {
    const errors = await validate(fromBody({ lastName: 7, email: 7 }));

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['lastName', 'email']),
    );
  });
});
