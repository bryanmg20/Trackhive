import { User } from '../../../users/domain/entities/user.entity';
import type { IUserRepository } from '../../../users/domain/repositories/user.repository';
import { Requester } from '../../domain/entities/requester.entity';
import { RequesterEmailMismatchError } from '../../domain/errors/requester-email-mismatch.error';
import { RequesterNameRequiredError } from '../../domain/errors/requester-name-required.error';
import { RequesterUserNotFoundError } from '../../domain/errors/requester-user-not-found.error';
import type { IRequesterRepository } from '../../domain/repositories/requester.repository';
import { RequesterResolver } from './requester-resolver';

const user = (overrides: Partial<ConstructorParameters<typeof User>[0]> = {}) =>
  new User({
    id: 'user-1',
    firstName: 'Juan',
    middleName: 'Carlos',
    lastName: 'Pérez',
    secondLastName: 'Gómez',
    email: 'juan@mail.com',
    passwordHash: 'hash',
    role: 'PUBLICO',
    active: true,
    ...overrides,
  });

const build = (found: { byUser?: Requester; byEmail?: Requester } = {}) => {
  const save = jest.fn<Promise<void>, [Requester]>(() => Promise.resolve());
  const requesters: IRequesterRepository = {
    findByUserId: jest.fn(() => Promise.resolve(found.byUser ?? null)),
    findByEmail: jest.fn(() => Promise.resolve(found.byEmail ?? null)),
    save,
  };
  const findById = jest.fn<Promise<User | null>, [string]>(() =>
    Promise.resolve(user()),
  );
  const findByEmail = jest.fn<Promise<User | null>, [string]>(() =>
    Promise.resolve(null),
  );
  const users: IUserRepository = {
    save: jest.fn(),
    findAll: jest.fn(),
    findFirstByRole: jest.fn(),
    search: jest.fn(),
    findById,
    findByEmail,
  };
  return {
    resolver: new RequesterResolver(requesters, users),
    save,
    findById,
    findByEmail,
  };
};

const savedRequester = (save: jest.Mock<Promise<void>, [Requester]>) =>
  save.mock.calls[0][0].props;

describe('RequesterResolver', () => {
  describe('forUser (HU-09)', () => {
    it("copies the user's four name fields to their new requester (issue #96)", async () => {
      const { resolver, save } = build();

      await resolver.forUser('user-1');

      expect(savedRequester(save)).toMatchObject({
        userId: 'user-1',
        firstName: 'Juan',
        middleName: 'Carlos',
        lastName: 'Pérez',
        secondLastName: 'Gómez',
        email: 'juan@mail.com',
      });
    });

    it('keeps the optional name fields null when the user has none', async () => {
      const { resolver, save, findById } = build();
      findById.mockResolvedValue(
        user({ firstName: 'Ana', middleName: null, secondLastName: null }),
      );

      await resolver.forUser('user-1');

      expect(savedRequester(save)).toMatchObject({
        firstName: 'Ana',
        middleName: null,
        lastName: 'Pérez',
        secondLastName: null,
      });
    });

    it('reuses the requester of a user who already has one', async () => {
      const existing = Requester.fromUser(user(), 'requester-1');
      const { resolver, save } = build({ byUser: existing });

      const result = await resolver.forUser('user-1');

      expect(result).toBe(existing);
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects an unknown user', async () => {
      const { resolver, findById } = build();
      findById.mockResolvedValue(null);

      await expect(resolver.forUser('user-x')).rejects.toBeInstanceOf(
        RequesterUserNotFoundError,
      );
    });
  });

  describe('forContact (HU-10)', () => {
    it('creates a visitor requester without an account', async () => {
      const { resolver, save } = build();

      await resolver.forContact({
        municipality: 'Barranquilla',
        ageRange: '18-28',
        email: 'Visitante@Ejemplo.com',
        firstName: 'Visitante',
        lastName: 'Prueba',
        phone: '3001234567',
      });

      expect(savedRequester(save)).toMatchObject({
        userId: null,
        email: 'visitante@ejemplo.com',
        firstName: 'Visitante',
        lastName: 'Prueba',
        phone: '3001234567',
        requesterType: 'CIUDADANO',
      });
    });

    it('reuses an existing requester found by email', async () => {
      const existing = Requester.fromContact(
        {
          municipality: 'Barranquilla',
          ageRange: '18-28',
          email: 'visitante@ejemplo.com',
          firstName: 'Visitante',
          lastName: 'Prueba',
        },
        'requester-existing',
      );
      const { resolver, save } = build({ byEmail: existing });

      const result = await resolver.forContact({
        email: 'visitante@ejemplo.com',
      });

      expect(result.id).toBe('requester-existing');
      expect(save).not.toHaveBeenCalled();
    });

    it('associates an existing user by id', async () => {
      const { resolver, save, findById } = build();
      findById.mockResolvedValue(
        user({ id: 'user-visitor', firstName: 'Ana', email: 'ana@mail.com' }),
      );

      await resolver.forContact({
        email: 'ana@mail.com',
        userId: 'user-visitor',
      });

      expect(savedRequester(save)).toMatchObject({
        userId: 'user-visitor',
        firstName: 'Ana',
        lastName: 'Pérez',
      });
    });

    it('rejects a user whose email is not the one given', async () => {
      const { resolver } = build();

      await expect(
        resolver.forContact({ email: 'otro@mail.com', userId: 'user-1' }),
      ).rejects.toBeInstanceOf(RequesterEmailMismatchError);
    });

    it('links a user account found by email instead of creating a visitor', async () => {
      const { resolver, save, findByEmail } = build();
      findByEmail.mockResolvedValue(user());

      await resolver.forContact({ email: 'juan@mail.com' });

      expect(savedRequester(save)).toMatchObject({ userId: 'user-1' });
    });

    it('requires the names of a new visitor', async () => {
      const { resolver } = build();

      await expect(
        resolver.forContact({ email: 'nuevo@mail.com' }),
      ).rejects.toBeInstanceOf(RequesterNameRequiredError);
    });
  });
});
