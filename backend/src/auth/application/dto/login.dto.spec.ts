import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(LoginDto, plain);

const check = async (plain: Record<string, unknown>) => validate(toDto(plain));

const valid = { email: 'investigador@ejemplo.com', password: 'secreto123' };

describe('LoginDto', () => {
  it('accepts a valid email and password', async () => {
    expect(await check(valid)).toHaveLength(0);
  });

  it('normalizes the email to lowercase without spaces', () => {
    const dto = toDto({ ...valid, email: '  Investigador@Ejemplo.COM ' });

    expect(dto.email).toBe('investigador@ejemplo.com');
  });

  // A length rule would answer 400 and hint that the password is wrong
  it('accepts a short password so a wrong one gets 401, not 400', async () => {
    expect(await check({ ...valid, password: 'a' })).toHaveLength(0);
  });

  it.each([
    ['email', undefined],
    ['email', ''],
    ['email', 'no-es-un-correo'],
    ['email', 42],
    ['password', undefined],
    ['password', ''],
    ['password', 12345678],
  ])('rejects %s = %s', async (field, value) => {
    const errors = await check({ ...valid, [field]: value });

    expect(errors.map((error) => error.property)).toContain(field);
  });
});
