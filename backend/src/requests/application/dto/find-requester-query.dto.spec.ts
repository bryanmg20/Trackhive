import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindRequesterQueryDto } from './find-requester-query.dto';

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(FindRequesterQueryDto, plain);

const check = async (plain: Record<string, unknown>) => validate(toDto(plain));

// Builds a valid address with the given total length (>= 129). IsEmail caps
// the local part at 64 chars and each domain label at 63, so the length goes
// into the domain labels: "v@" (2) + 60 + "." + 60 + "." + rest + ".com" (4)
const emailOfLength = (length: number) =>
  `v@${'d'.repeat(60)}.${'d'.repeat(60)}.${'d'.repeat(length - 128)}.com`;

describe('FindRequesterQueryDto', () => {
  it('accepts a valid email', async () => {
    expect(await check({ email: 'visitante@ejemplo.com' })).toHaveLength(0);
  });

  it('normalizes the email to lowercase without spaces', () => {
    const dto = toDto({ email: '  Visitante@Ejemplo.COM ' });

    expect(dto.email).toBe('visitante@ejemplo.com');
  });

  it('accepts an email at the maximum length', async () => {
    expect(await check({ email: emailOfLength(160) })).toHaveLength(0);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['badly formed', 'no-es-un-correo'],
    ['not text', 42],
    ['too long', emailOfLength(161)],
  ])('rejects an email that is %s', async (_case, email) => {
    const errors = await check({ email });

    expect(errors.map((error) => error.property)).toContain('email');
  });
});
