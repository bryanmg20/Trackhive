import { CreateUserUseCase } from './create-user.use-case';
import { User } from '../../domain/entities/user.entity';
import { EmailAlreadyExistsError } from '../../domain/errors/email-already-exists.error';
import { PrivacyConsentRequiredError } from '../../domain/errors/privacy-consent-required.error';
import { IUserRepository } from '../../domain/repositories/user.repository';
import type { IPasswordHasher } from '../ports/password-hasher.port';
import type { Requester } from '../../../requests/domain/entities/requester.entity';

class InMemoryUserRepository implements IUserRepository {
  private readonly users = new Map<string, User>();

  save(user: User): Promise<void> {
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  findAll(): Promise<User[]> {
    return Promise.resolve([...this.users.values()]);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByEmail(email: string): Promise<User | null> {
    const user = [...this.users.values()].find(
      (candidate) => candidate.email === email,
    );
    return Promise.resolve(user ?? null);
  }
}

const consent = {
  municipality: 'Barranquilla',
  ageRange: '18-28',
  acceptedPrivacy: true,
  privacyPolicyVersion: '1.1',
};

describe('CreateUserUseCase', () => {
  let repository: InMemoryUserRepository;
  let hasher: IPasswordHasher;
  let useCase: CreateUserUseCase;
  let hash: jest.Mock<Promise<string>, [string]>;
  let registeredRequester: Requester;

  beforeEach(() => {
    repository = new InMemoryUserRepository();
    hash = jest.fn((password: string) => Promise.resolve(`hashed:${password}`));
    hasher = { hash, verify: jest.fn() };
    useCase = new CreateUserUseCase(repository, hasher, {
      save: async (user, requester) => {
        await repository.save(user);
        registeredRequester = requester;
      },
    });
  });

  it('hashes the password and creates a public account', async () => {
    const response = await useCase.execute({
      firstName: '  Ana ',
      middleName: ' María ',
      lastName: ' Pérez ',
      secondLastName: ' Gómez ',
      email: '  ANA@MAIL.COM ',
      password: 'secreto123',
      ...consent,
    });

    expect(hash).toHaveBeenCalledWith('secreto123');
    expect(response).toMatchObject({
      firstName: 'Ana',
      middleName: 'María',
      lastName: 'Pérez',
      secondLastName: 'Gómez',
      email: 'ana@mail.com',
      role: 'PUBLICO',
    });
    expect(response).not.toHaveProperty('password');
    expect(response).not.toHaveProperty('passwordHash');

    const saved = await repository.findByEmail('ana@mail.com');
    expect(saved?.passwordHash).toBe('hashed:secreto123');
    expect(saved?.passwordHash).not.toBe('secreto123');
    expect(saved?.role).toBe('PUBLICO');
    expect(registeredRequester.props).toMatchObject({
      userId: saved?.id,
      municipality: 'Barranquilla',
      ageRange: '18-28',
      populationGroup: null,
    });
    expect(saved?.privacyPolicyAcceptedAt).toBeInstanceOf(Date);
    expect(saved?.privacyPolicyVersion).toBe('1.1');
  });

  it('creates an account with only the required name fields', async () => {
    const response = await useCase.execute({
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@mail.com',
      password: 'secreto123',
      ...consent,
    });

    expect(response).toMatchObject({
      firstName: 'Ana',
      middleName: null,
      lastName: 'Pérez',
      secondLastName: null,
    });
  });

  it('rejects an email that is already registered', async () => {
    const input = {
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@mail.com',
      password: 'secreto123',
      ...consent,
    };

    await useCase.execute(input);

    await expect(
      useCase.execute({ ...input, email: 'ANA@MAIL.COM' }),
    ).rejects.toThrow(EmailAlreadyExistsError);
    expect(hash).toHaveBeenCalledTimes(1);
  });

  it('rejects a registration without the privacy consent', async () => {
    await expect(
      useCase.execute({
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@mail.com',
        password: 'secreto123',
        ...consent,
        acceptedPrivacy: false,
      }),
    ).rejects.toThrow(PrivacyConsentRequiredError);

    expect(hash).not.toHaveBeenCalled();
  });

  it('rejects a registration that accepts an outdated notice version', async () => {
    await expect(
      useCase.execute({
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@mail.com',
        password: 'secreto123',
        ...consent,
        privacyPolicyVersion: '0.9',
      }),
    ).rejects.toThrow(PrivacyConsentRequiredError);

    expect(hash).not.toHaveBeenCalled();
  });
});
