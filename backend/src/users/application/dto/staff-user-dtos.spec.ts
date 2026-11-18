import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateStaffUserDto } from './create-staff-user.dto';
import { ListStaffUsersQueryDto } from './list-staff-users-query.dto';
import { UpdateStaffUserDto } from './update-staff-user.dto';

const fieldsWithErrors = async (dto: object): Promise<string[]> =>
  (await validate(dto)).map((error) => error.property);

// Same options as the global ValidationPipe: undeclared fields are rejected
const notAllowedFields = async (dto: object): Promise<string[]> =>
  (await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).map(
    (error) => error.property,
  );

describe('CreateStaffUserDto (HU-05)', () => {
  const fromBody = (overrides: Record<string, unknown> = {}) =>
    plainToInstance(CreateStaffUserDto, {
      firstName: '  Laura ',
      middleName: '  ',
      lastName: 'Gómez',
      email: ' Laura@CLENA.org ',
      password: 'inicial123',
      ...overrides,
    });

  it('accepts a staff account and reuses the registration transforms', async () => {
    const dto = fromBody();

    await expect(fieldsWithErrors(dto)).resolves.toEqual([]);
    expect(dto.firstName).toBe('Laura');
    expect(dto.middleName).toBeNull();
    expect(dto.email).toBe('laura@clena.org');
  });

  it.each(['ADMIN', 'PERSONAL'])(
    'does not accept a role (%s): the server always creates PERSONAL',
    async (role) => {
      await expect(notAllowedFields(fromBody({ role }))).resolves.toEqual([
        'role',
      ]);
    },
  );

  it('requires an initial password of at least 8 characters', async () => {
    await expect(
      fieldsWithErrors(fromBody({ password: 'corta' })),
    ).resolves.toContain('password');
    await expect(
      fieldsWithErrors(fromBody({ password: undefined })),
    ).resolves.toContain('password');
  });

  it('does not ask for the characterization or the privacy consent', () => {
    const dto = new CreateStaffUserDto();

    expect(dto).not.toHaveProperty('municipality');
    expect(dto).not.toHaveProperty('acceptedPrivacy');
  });
});

describe('UpdateStaffUserDto (HU-05)', () => {
  const fromBody = (body: Record<string, unknown>) =>
    plainToInstance(UpdateStaffUserDto, body);

  it('accepts an empty body: nothing changes', async () => {
    await expect(fieldsWithErrors(fromBody({}))).resolves.toEqual([]);
  });

  it('accepts a deactivation and new names', async () => {
    const dto = fromBody({
      active: false,
      firstName: ' Lucía ',
      secondLastName: '',
    });

    await expect(fieldsWithErrors(dto)).resolves.toEqual([]);
    expect(dto.firstName).toBe('Lucía');
    expect(dto.secondLastName).toBeNull();
  });

  it.each([
    ['active', null],
    ['active', 'false'],
    ['firstName', '   '],
    ['email', 'sin-arroba'],
  ])('rejects %s = %p', async (field, value) => {
    await expect(
      fieldsWithErrors(fromBody({ [field]: value })),
    ).resolves.toContain(field);
  });

  it.each([
    ['role', 'ADMIN'],
    ['password', 'nueva1234'],
  ])('does not edit %s: the field is not allowed', async (field, value) => {
    await expect(
      notAllowedFields(fromBody({ [field]: value })),
    ).resolves.toEqual([field]);
  });
});

describe('ListStaffUsersQueryDto (HU-05)', () => {
  const fromQuery = (query: Record<string, string>) =>
    plainToInstance(ListStaffUsersQueryDto, query);

  it('turns the query text into typed filters', async () => {
    const dto = fromQuery({
      q: '  ana  ',
      role: 'ADMIN',
      active: 'false',
      sort: 'email',
      order: 'desc',
      page: '2',
      limit: '5',
    });

    await expect(fieldsWithErrors(dto)).resolves.toEqual([]);
    expect(dto).toMatchObject({
      q: 'ana',
      role: 'ADMIN',
      active: false,
      sort: 'email',
      order: 'desc',
      page: 2,
      limit: 5,
    });
  });

  it('reads active=true and treats blank text as no filter', async () => {
    const dto = fromQuery({ active: 'true', q: '   ' });

    await expect(fieldsWithErrors(dto)).resolves.toEqual([]);
    expect(dto.active).toBe(true);
    expect(dto.q).toBeUndefined();
  });

  it.each([
    ['active', 'si'],
    ['role', 'PUBLICO'],
    ['sort', 'passwordHash'],
    ['order', 'up'],
    ['page', '0'],
    ['limit', '101'],
    ['q', 'a'.repeat(101)],
  ])('rejects %s = %s', async (field, value) => {
    await expect(
      fieldsWithErrors(fromQuery({ [field]: value })),
    ).resolves.toContain(field);
  });
});
