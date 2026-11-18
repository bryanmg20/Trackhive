import { InMemoryUserRepository } from '../../../../test/fakes/in-memory-user.repository';
import { DEFAULT_USER_PAGE_LIMIT } from '../../../common/pagination';
import { User } from '../../domain/entities/user.entity';
import type { UserRole } from '../../domain/enums/user-role';
import type { StaffRole } from '../../domain/enums/user-role';
import { ListStaffUsersUseCase } from './list-staff-users.use-case';

const account = (
  id: string,
  firstName: string,
  lastName: string,
  role: UserRole,
  active = true,
) =>
  new User({
    id,
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@clena.org`,
    passwordHash: 'hash',
    role,
    active,
  });

describe('ListStaffUsersUseCase (HU-05)', () => {
  let users: InMemoryUserRepository;
  let useCase: ListStaffUsersUseCase;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    for (const user of [
      account('1', 'Laura', 'Castro', 'PERSONAL'),
      account('2', 'Mario', 'Acosta', 'ADMIN'),
      account('3', 'Ana', 'Barrios', 'PERSONAL', false),
      account('4', 'Pedro', 'Díaz', 'PUBLICO'),
    ]) {
      await users.save(user);
    }
    useCase = new ListStaffUsersUseCase(users);
  });

  const lastNames = (items: { lastName: string }[]) =>
    items.map((item) => item.lastName);

  it('lists only staff accounts, by last name, with the default page', async () => {
    const response = await useCase.execute({});

    expect(lastNames(response.items)).toEqual(['Acosta', 'Barrios', 'Castro']);
    expect(response).toMatchObject({
      page: 1,
      limit: DEFAULT_USER_PAGE_LIMIT,
      total: 3,
    });
    expect(response.items[1]).toMatchObject({
      email: 'ana.barrios@clena.org',
      role: 'PERSONAL',
      active: false,
    });
    expect(response.items[0]).not.toHaveProperty('passwordHash');
  });

  it('paginates and reports the total of the filter', async () => {
    const first = await useCase.execute({ limit: 2, page: 1 });
    const second = await useCase.execute({ limit: 2, page: 2 });

    expect(lastNames(first.items)).toEqual(['Acosta', 'Barrios']);
    expect(lastNames(second.items)).toEqual(['Castro']);
    expect(second).toMatchObject({ page: 2, limit: 2, total: 3 });
  });

  it.each<[StaffRole, string[]]>([
    ['ADMIN', ['Acosta']],
    ['PERSONAL', ['Barrios', 'Castro']],
  ])('filters by the %s role', async (role, expected) => {
    const response = await useCase.execute({ role });

    expect(lastNames(response.items)).toEqual(expected);
  });

  it.each([
    [true, ['Acosta', 'Castro']],
    [false, ['Barrios']],
  ])('filters by active = %s', async (active, expected) => {
    const response = await useCase.execute({ active });

    expect(lastNames(response.items)).toEqual(expected);
  });

  it('finds every word of the text in the names or the email', async () => {
    expect(
      lastNames((await useCase.execute({ q: 'laura castro' })).items),
    ).toEqual(['Castro']);
    expect(
      lastNames((await useCase.execute({ q: 'MARIO.ACOSTA@' })).items),
    ).toEqual(['Acosta']);
    // A public account never shows up, even when it matches
    expect((await useCase.execute({ q: 'pedro' })).total).toBe(0);
  });

  it('sorts by the chosen field and direction', async () => {
    const response = await useCase.execute({
      sort: 'firstName',
      order: 'desc',
    });

    expect(response.items.map((item) => item.firstName)).toEqual([
      'Mario',
      'Laura',
      'Ana',
    ]);
  });

  it('asks the repository for staff roles only, with the defaults', async () => {
    const search = jest.spyOn(users, 'search');

    await useCase.execute({});
    await useCase.execute({ role: 'PUBLICO' as StaffRole });

    expect(search).toHaveBeenNthCalledWith(1, {
      q: undefined,
      roles: ['PERSONAL', 'ADMIN'],
      active: undefined,
      sort: 'lastName',
      order: 'asc',
      page: 1,
      limit: DEFAULT_USER_PAGE_LIMIT,
    });
    // A role that is not staff matches no account
    expect(search).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ roles: [] }),
    );
  });
});
