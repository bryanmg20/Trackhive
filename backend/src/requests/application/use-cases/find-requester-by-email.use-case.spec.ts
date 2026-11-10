import { RequesterNotFoundError } from '../../domain/errors/requester-not-found.error';
import { FindRequesterByEmailUseCase } from './find-requester-by-email.use-case';

describe('FindRequesterByEmailUseCase', () => {
  const profile = {
    requesterId: 'requester-1',
    userId: null,
    firstName: 'Visitante',
    middleName: null,
    lastName: 'Prueba',
    secondLastName: null,
    email: 'visitante@ejemplo.com',
    phone: '3001234567',
    requesterType: 'CIUDADANO',
    institution: null,
    documentType: 'CC',
    documentNumber: '123456789',
    foundIn: 'REQUESTER' as const,
  };

  it('normalizes the email and returns the requester data', async () => {
    const repository = {
      create: jest.fn(),
      createOnBehalf: jest.fn(),
      findRequesterByEmail: jest.fn().mockResolvedValue(profile),
      list: jest.fn(),
      listAppointments: jest.fn(),
      findById: jest.fn(),
      listByRequesterUser: jest.fn(),
      findEntityById: jest.fn(),
      findMaterialAvailability: jest.fn(),
      findNotificationContext: jest.fn(),
      saveStatusChange: jest.fn(),
      saveAppointment: jest.fn(),
    };
    const useCase = new FindRequesterByEmailUseCase(repository);

    const result = await useCase.execute(' Visitante@Ejemplo.com ');

    expect(repository.findRequesterByEmail).toHaveBeenCalledWith(
      'visitante@ejemplo.com',
    );
    expect(result).toMatchObject({
      requesterId: 'requester-1',
      email: 'visitante@ejemplo.com',
      foundIn: 'REQUESTER',
    });
  });

  it('throws when the email is unknown', async () => {
    const repository = {
      create: jest.fn(),
      createOnBehalf: jest.fn(),
      findRequesterByEmail: jest.fn().mockResolvedValue(null),
      list: jest.fn(),
      listAppointments: jest.fn(),
      findById: jest.fn(),
      listByRequesterUser: jest.fn(),
      findEntityById: jest.fn(),
      findMaterialAvailability: jest.fn(),
      findNotificationContext: jest.fn(),
      saveStatusChange: jest.fn(),
      saveAppointment: jest.fn(),
    };
    const useCase = new FindRequesterByEmailUseCase(repository);

    await expect(useCase.execute('nadie@ejemplo.com')).rejects.toBeInstanceOf(
      RequesterNotFoundError,
    );
  });
});
