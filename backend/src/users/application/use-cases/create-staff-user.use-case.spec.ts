import { InMemoryUserRepository } from '../../../../test/fakes/in-memory-user.repository';
import { User } from '../../domain/entities/user.entity';
import { EmailAlreadyExistsError } from '../../domain/errors/email-already-exists.error';
import type { CreateStaffUserInput } from '../dto/create-staff-user.input';
import type { IPasswordHasher } from '../ports/password-hasher.port';
import { CreateStaffUserUseCase } from './create-staff-user.use-case';

const input = (
  overrides: Partial<CreateStaffUserInput> = {},
): CreateStaffUserInput => ({
  firstName: ' Laura ',
  middleName: null,
  lastName: 'Gómez',
  secondLastName: 'Ríos',
  email: '  LAURA@CLENA.ORG ',
  password: 'inicial123',
  ...overrides,
});

describe('CreateStaffUserUseCase (HU-05)', () => {
  let users: InMemoryUserRepository;
  let hash: jest.Mock<Promise<string>, [string]>;
  let useCase: CreateStaffUserUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    hash = jest.fn((password: string) => Promise.resolve(`hashed:${password}`));
    const hasher: IPasswordHasher = { hash, verify: jest.fn() };
    useCase = new CreateStaffUserUseCase(users, hasher);
  });

  it('creates an active PERSONAL account with the hashed initial password', async () => {
    const response = await useCase.execute(input());

    expect(response).toMatchObject({
      firstName: 'Laura',
      middleName: null,
      lastName: 'Gómez',
      secondLastName: 'Ríos',
      email: 'laura@clena.org',
      role: 'PERSONAL',
      active: true,
    });
    expect(response).not.toHaveProperty('password');
    expect(response).not.toHaveProperty('passwordHash');

    expect(hash).toHaveBeenCalledWith('inicial123');
    const saved = await users.findById(response.id);
    expect(saved).toMatchObject({
      role: 'PERSONAL',
      active: true,
      passwordHash: 'hashed:inicial123',
      privacyPolicyAcceptedAt: null,
    });
  });

  it('never creates an ADMIN, even if a role is slipped into the input', async () => {
    const response = await useCase.execute({
      ...input(),
      role: 'ADMIN',
    } as CreateStaffUserInput);

    expect(response.role).toBe('PERSONAL');
    expect((await users.findById(response.id))?.role).toBe('PERSONAL');
  });

  it('rejects an email already registered, in any case, before hashing', async () => {
    await users.save(
      new User({
        id: 'other',
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'laura@clena.org',
        passwordHash: 'hash',
        role: 'PUBLICO',
        active: true,
      }),
    );

    await expect(useCase.execute(input())).rejects.toThrow(
      EmailAlreadyExistsError,
    );
    expect(hash).not.toHaveBeenCalled();
    expect(await users.findAll()).toHaveLength(1);
  });
});
