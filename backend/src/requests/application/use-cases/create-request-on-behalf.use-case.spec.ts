import { Request } from '../../domain/entities/request.entity';
import { Requester } from '../../domain/entities/requester.entity';
import { DesiredDateError } from '../../domain/errors/desired-date-invalid.error';
import { RequestMaterialNotFoundError } from '../../domain/errors/request-material-not-found.error';
import { RequestMaterialsRequiredError } from '../../domain/errors/request-materials-required.error';
import { RequesterEmailRequiredError } from '../../domain/errors/requester-email-required.error';
import { RequesterNameRequiredError } from '../../domain/errors/requester-name-required.error';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import {
  addBusinessDays,
  todayInBogota,
} from '../../domain/value-objects/desired-date';
import type { CreateRequestOnBehalfInput } from '../dto/create-request-on-behalf.input';
import type { IRequestQueryService } from '../ports/request-query.port';
import type { RequesterResolver } from '../services/requester-resolver';
import { CreateRequestOnBehalfUseCase } from './create-request-on-behalf.use-case';

const validDate = () =>
  addBusinessDays(todayInBogota(), 10).toISOString().slice(0, 10);

const VISITOR = Requester.fromContact(
  {
    municipality: 'Barranquilla',
    ageRange: '18-28',
    email: 'visitante@ejemplo.com',
    firstName: 'Visitante',
    lastName: 'Prueba',
  },
  'requester-1',
);

describe('CreateRequestOnBehalfUseCase', () => {
  const save = jest.fn<Promise<void>, [Request]>(() => Promise.resolve());
  const repository: IRequestRepository = {
    save,
    findById: jest.fn(),
    findAppointmentById: jest.fn(),
    saveStatusChange: jest.fn(),
    saveAppointment: jest.fn(),
    rescheduleAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
  };
  const findMissingMaterialIds = jest.fn<
    Promise<string[]>,
    [readonly string[]]
  >(() => Promise.resolve([]));
  const queries: IRequestQueryService = {
    list: jest.fn(),
    listByRequesterUser: jest.fn(),
    findHistory: jest.fn(),
    findDetail: jest.fn(),
    listAppointments: jest.fn(),
    findRequesterByEmail: jest.fn(),
    findNotificationContext: jest.fn(),
    findSchedulingConflicts: jest.fn(),
    findMissingMaterialIds,
    countActiveAppointmentsOnDate: jest.fn(),
    countActiveAppointmentsByDateRange: jest.fn(),
  };
  const forContact = jest.fn(() => Promise.resolve(VISITOR));
  const useCase = new CreateRequestOnBehalfUseCase(
    repository,
    queries,
    { next: () => Promise.resolve('SOL-2026-00002') },
    { forContact } as unknown as RequesterResolver,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findMissingMaterialIds.mockResolvedValue([]);
  });

  const input = (): CreateRequestOnBehalfInput => ({
    materialIds: ['material-1'],
    reason: 'Consulta para un trabajo de investigación',
    desiredDate: validDate(),
    deliveryMode: 'PRESENCIAL' as const,
    requester: {
      email: 'visitante@ejemplo.com',
      firstName: 'Visitante',
      lastName: 'Prueba',
    },
    createdById: 'staff-1',
  });

  it('registers the request with the staff member as creator, in person', async () => {
    const result = await useCase.execute(input());

    expect(forContact).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'visitante@ejemplo.com' }),
    );
    const [saved] = save.mock.calls[0];
    expect(saved.registration).toMatchObject({
      trackingCode: 'SOL-2026-00002',
      requesterId: 'requester-1',
      createdById: 'staff-1',
      originChannel: 'PRESENCIAL',
    });
    expect(result).toMatchObject({
      trackingCode: 'SOL-2026-00002',
      status: 'RECIBIDA',
    });
  });

  it('accepts an existing user without repeating the names', async () => {
    const data = input();
    data.requester = { email: 'usuario@ejemplo.com', userId: 'user-1' };

    await useCase.execute(data);

    expect(save).toHaveBeenCalled();
  });

  it('rejects a date earlier than ten business days', async () => {
    const data = {
      ...input(),
      desiredDate: addBusinessDays(todayInBogota(), 1)
        .toISOString()
        .slice(0, 10),
    };

    await expect(useCase.execute(data)).rejects.toBeInstanceOf(
      DesiredDateError,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a request without materials', async () => {
    const data = { ...input(), materialIds: [] };

    await expect(useCase.execute(data)).rejects.toBeInstanceOf(
      RequestMaterialsRequiredError,
    );
  });

  it('rejects a material that is not in the catalog', async () => {
    findMissingMaterialIds.mockResolvedValue(['material-1']);

    await expect(useCase.execute(input())).rejects.toBeInstanceOf(
      RequestMaterialNotFoundError,
    );
    expect(forContact).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a request without requester email', async () => {
    const data = input();
    data.requester = { ...data.requester, email: '' };

    await expect(useCase.execute(data)).rejects.toBeInstanceOf(
      RequesterEmailRequiredError,
    );
  });

  it('rejects a new requester without names', async () => {
    forContact.mockRejectedValueOnce(new RequesterNameRequiredError());
    const data = input();
    data.requester = { email: 'visitante@ejemplo.com' };

    await expect(useCase.execute(data)).rejects.toBeInstanceOf(
      RequesterNameRequiredError,
    );
  });
});
