import { InMemoryUserRepository } from '../../../../test/fakes/in-memory-user.repository';
import { User } from '../../domain/entities/user.entity';
import { EmailAlreadyExistsError } from '../../domain/errors/email-already-exists.error';
import { WeakAdminPasswordError } from '../../domain/errors/weak-admin-password.error';
import type { UserRole } from '../../domain/enums/user-role';
import type { BootstrapAdminInput } from '../dto/bootstrap-admin.input';
import type { IPasswordHasher } from '../ports/password-hasher.port';
import { BootstrapAdminUseCase } from './bootstrap-admin.use-case';

const input = (
  overrides: Partial<BootstrapAdminInput> = {},
): BootstrapAdminInput => ({
  email: '  ADMIN@CLENA.ORG ',
  password: 'una-clave-larga',
  requireStrongPassword: true,
  ...overrides,
});

const account = (role: UserRole, active = true) =>
  new User({
    id: `${role}-1`,
    firstName: 'Ana',
    lastName: 'Pérez',
    email: `${role.toLowerCase()}@clena.org`,
    passwordHash: 'hashed:anterior',
    role,
    active,
  });

describe('BootstrapAdminUseCase (HU-42)', () => {
  let users: InMemoryUserRepository;
  let hash: jest.Mock<Promise<string>, [string]>;
  let useCase: BootstrapAdminUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    hash = jest.fn((password: string) => Promise.resolve(`hashed:${password}`));
    const hasher: IPasswordHasher = { hash, verify: jest.fn() };
    useCase = new BootstrapAdminUseCase(users, hasher);
  });

  it('creates an active ADMIN with the hashed password when there is none', async () => {
    await users.save(account('PERSONAL'));

    await expect(useCase.execute(input())).resolves.toBe(true);

    const admin = await users.findByEmail('admin@clena.org');
    expect(admin).toMatchObject({
      role: 'ADMIN',
      active: true,
      passwordHash: 'hashed:una-clave-larga',
    });
    expect(hash).toHaveBeenCalledWith('una-clave-larga');
  });

  it('does nothing when an ADMIN already exists: no new account, no password reset', async () => {
    const existing = account('ADMIN');
    await users.save(existing);

    await expect(useCase.execute(input())).resolves.toBe(false);

    expect(await users.findAll()).toEqual([existing]);
    expect(hash).not.toHaveBeenCalled();
  });

  it('does not reactivate an inactive ADMIN nor create another one', async () => {
    const inactive = account('ADMIN', false);
    await users.save(inactive);

    await expect(
      useCase.execute(input({ email: inactive.email })),
    ).resolves.toBe(false);

    expect(await users.findAll()).toEqual([inactive]);
  });

  it('does not turn another account with that email into an ADMIN', async () => {
    const staff = account('PERSONAL');
    await users.save(staff);

    await expect(
      useCase.execute(input({ email: staff.email })),
    ).rejects.toThrow(EmailAlreadyExistsError);

    expect(await users.findAll()).toEqual([staff]);
  });

  it('rejects a password under 12 characters in production', async () => {
    await expect(
      useCase.execute(input({ password: 'corta123456' })),
    ).rejects.toThrow(WeakAdminPasswordError);

    expect(await users.findAll()).toEqual([]);
  });

  it('checks the password even when the ADMIN already exists', async () => {
    await users.save(account('ADMIN'));

    await expect(useCase.execute(input({ password: '1' }))).rejects.toThrow(
      WeakAdminPasswordError,
    );
  });

  it('accepts exactly 12 characters in production', async () => {
    await expect(
      useCase.execute(input({ password: '123456789012' })),
    ).resolves.toBe(true);
  });

  it('accepts a short password in development (RUN_SEED=true)', async () => {
    await expect(
      useCase.execute(input({ password: '1', requireStrongPassword: false })),
    ).resolves.toBe(true);
  });
});
