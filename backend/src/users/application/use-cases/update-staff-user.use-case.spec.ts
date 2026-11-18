import { InMemoryUserRepository } from '../../../../test/fakes/in-memory-user.repository';
import { User } from '../../domain/entities/user.entity';
import type { UserRole } from '../../domain/enums/user-role';
import { CannotChangeOwnAccessError } from '../../domain/errors/cannot-change-own-access.error';
import { EmailAlreadyExistsError } from '../../domain/errors/email-already-exists.error';
import { StaffUserNotFoundError } from '../../domain/errors/staff-user-not-found.error';
import type { UpdateStaffUserInput } from '../dto/update-staff-user.input';
import { UpdateStaffUserUseCase } from './update-staff-user.use-case';

const ADMIN_ID = 'admin-1';
const STAFF_ID = 'staff-1';
const PUBLIC_ID = 'public-1';

const account = (id: string, email: string, role: UserRole) =>
  new User({
    id,
    firstName: 'Laura',
    middleName: 'Sofía',
    lastName: 'Gómez',
    email,
    passwordHash: 'hash',
    role,
    active: true,
  });

describe('UpdateStaffUserUseCase (HU-05)', () => {
  let users: InMemoryUserRepository;
  let useCase: UpdateStaffUserUseCase;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    await users.save(account(ADMIN_ID, 'admin@clena.org', 'ADMIN'));
    await users.save(account(STAFF_ID, 'laura@clena.org', 'PERSONAL'));
    await users.save(account(PUBLIC_ID, 'ana@mail.com', 'PUBLICO'));
    useCase = new UpdateStaffUserUseCase(users);
  });

  it('edits the names and email and keeps the role', async () => {
    const response = await useCase.execute({
      userId: STAFF_ID,
      firstName: 'Lucía',
      middleName: null,
      email: 'Lucia@CLENA.org',
      changedBy: ADMIN_ID,
    });

    expect(response).toMatchObject({
      id: STAFF_ID,
      firstName: 'Lucía',
      middleName: null,
      lastName: 'Gómez',
      email: 'lucia@clena.org',
      role: 'PERSONAL',
      active: true,
    });
    expect(await users.findById(STAFF_ID)).toMatchObject({
      firstName: 'Lucía',
      email: 'lucia@clena.org',
      role: 'PERSONAL',
    });
  });

  it('never promotes PERSONAL to ADMIN, even if a role is slipped in', async () => {
    await useCase.execute({
      userId: STAFF_ID,
      role: 'ADMIN',
      changedBy: ADMIN_ID,
    } as UpdateStaffUserInput);

    expect((await users.findById(STAFF_ID))?.role).toBe('PERSONAL');
  });

  it('deactivates an account and can reactivate it', async () => {
    const deactivated = await useCase.execute({
      userId: STAFF_ID,
      active: false,
      changedBy: ADMIN_ID,
    });
    expect(deactivated.active).toBe(false);
    expect((await users.findById(STAFF_ID))?.active).toBe(false);

    const reactivated = await useCase.execute({
      userId: STAFF_ID,
      active: true,
      changedBy: ADMIN_ID,
    });
    expect(reactivated.active).toBe(true);
  });

  it.each([
    ['an unknown id', 'missing'],
    ['a public account', PUBLIC_ID],
  ])('answers STAFF_USER_NOT_FOUND for %s', async (_case, userId) => {
    await expect(
      useCase.execute({ userId, active: false, changedBy: ADMIN_ID }),
    ).rejects.toThrow(StaffUserNotFoundError);
    expect((await users.findById(PUBLIC_ID))?.active).toBe(true);
  });

  it('rejects an email that belongs to another account', async () => {
    await expect(
      useCase.execute({
        userId: STAFF_ID,
        email: 'admin@clena.org',
        changedBy: ADMIN_ID,
      }),
    ).rejects.toThrow(EmailAlreadyExistsError);
    expect((await users.findById(STAFF_ID))?.email).toBe('laura@clena.org');
  });

  it('keeps the same email when only its case changes', async () => {
    const response = await useCase.execute({
      userId: STAFF_ID,
      email: 'LAURA@clena.org',
      changedBy: ADMIN_ID,
    });

    expect(response.email).toBe('laura@clena.org');
  });

  it('does not let the administrator deactivate their own account', async () => {
    const save = jest.spyOn(users, 'save');

    await expect(
      useCase.execute({ userId: ADMIN_ID, active: false, changedBy: ADMIN_ID }),
    ).rejects.toThrow(CannotChangeOwnAccessError);
    expect(save).not.toHaveBeenCalled();
    expect((await users.findById(ADMIN_ID))?.active).toBe(true);
  });
});
