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
