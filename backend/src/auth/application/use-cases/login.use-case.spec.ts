import { LoginUseCase } from './login.use-case';
import type { PasswordHasher } from '../../../users/application/ports/password-hasher.port';
import { User } from '../../../users/domain/entities/user.entity';
import type { IUserRepository } from '../../../users/domain/repositories/user.repository';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import type { TokenService } from '../ports/token-service.port';

const buildUser = (active = true): User =>
  new User({
    id: 'user-1',
    fullName: 'Ana Pérez',
    email: 'ana@mail.com',
    passwordHash: 'hashed:secreto123',
    role: 'PUBLICO',
    active,
  });

describe('LoginUseCase', () => {
  let storedUser: User | null;
  let useCase: LoginUseCase;
  let signAccessToken: jest.Mock<Promise<string>, []>;

  beforeEach(() => {
    storedUser = buildUser();
    const repository: IUserRepository = {
      save: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn((email: string) =>
        Promise.resolve(storedUser?.email === email ? storedUser : null),
      ),
    };
    const hasher: PasswordHasher = {
      hash: jest.fn(),
      verify: jest.fn((plain: string, hash: string) =>
        Promise.resolve(hash === `hashed:${plain}`),
      ),
    };
    signAccessToken = jest.fn(() => Promise.resolve('access-token'));
    const tokenService: TokenService = {
      signAccessToken,
      signRefreshToken: jest.fn(() => Promise.resolve('refresh-token')),
    };
    useCase = new LoginUseCase(repository, hasher, tokenService);
  });

  it('returns an access token and a refresh token for valid credentials', async () => {
    const response = await useCase.execute({
      email: ' ANA@MAIL.COM ',
      password: 'secreto123',
    });

    expect(response).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(signAccessToken).toHaveBeenCalledWith({
      sub: 'user-1',
      role: 'PUBLICO',
    });
  });

  it.each([
    ['an unknown email', { email: 'otro@mail.com', password: 'secreto123' }],
    ['a wrong password', { email: 'ana@mail.com', password: 'otra-clave' }],
  ])('rejects %s with the same generic error', async (_case, input) => {
    await expect(useCase.execute(input)).rejects.toThrow(
      new InvalidCredentialsError(),
    );
    expect(signAccessToken).not.toHaveBeenCalled();
  });

  it('rejects an inactive account', async () => {
    storedUser = buildUser(false);

    await expect(
      useCase.execute({ email: 'ana@mail.com', password: 'secreto123' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });
});
