import { Request } from '../../domain/entities/request.entity';
import { Requester } from '../../domain/entities/requester.entity';
import { DesiredDateError } from '../../domain/errors/desired-date-invalid.error';
import { RequestMaterialNotFoundError } from '../../domain/errors/request-material-not-found.error';
import { RequestMaterialsRequiredError } from '../../domain/errors/request-materials-required.error';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import {
  addBusinessDays,
  isAttendedDate,
  todayInBogota,
} from '../../domain/value-objects/desired-date';
import type { CreateRequestInput } from '../dto/create-request.input';
import type { IRequestQueryService } from '../ports/request-query.port';
import type { RequesterResolver } from '../services/requester-resolver';
import { CreateRequestUseCase } from './create-request.use-case';

const REQUESTER = Requester.fromUser(
  {
    id: 'user-1',
    firstName: 'Juan',
    middleName: null,
    lastName: 'Pérez',
    secondLastName: null,
    email: 'juan@mail.com',
  },
  'requester-1',
);

const build = () => {
  const save = jest.fn<Promise<void>, [Request]>(() => Promise.resolve());
  const repository: IRequestRepository = {
    save,
    findById: jest.fn(),
    saveStatusChange: jest.fn(),
    saveAppointment: jest.fn(),
  };
  const findMissingMaterialIds = jest.fn<
    Promise<string[]>,
    [readonly string[]]
  >(() => Promise.resolve([]));
  const queries: IRequestQueryService = {
    list: jest.fn(),
    listByRequesterUser: jest.fn(),
    findDetail: jest.fn(),
    listAppointments: jest.fn(),
    findRequesterByEmail: jest.fn(),
    findNotificationContext: jest.fn(),
    findSchedulingConflicts: jest.fn(),
    findMissingMaterialIds,
  };
  const forUser = jest.fn(() => Promise.resolve(REQUESTER));
  const resolver = { forUser } as unknown as RequesterResolver;
  const useCase = new CreateRequestUseCase(
    repository,
    queries,
    { next: () => Promise.resolve('SOL-2026-00001') },
    resolver,
  );
  return { useCase, save, findMissingMaterialIds, forUser };
};

const input = (desiredDate: string): CreateRequestInput => ({
  materialIds: ['material-1'],
  reason: 'Consulta de investigación',
  desiredDate,
  deliveryMode: 'PRESENCIAL',
  userId: 'user-1',
});

const validDate = () =>
  addBusinessDays(todayInBogota(), 10).toISOString().slice(0, 10);

describe('CreateRequestUseCase', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('adds ten weekdays without counting weekends', () => {
    const result = addBusinessDays(new Date('2026-11-06T00:00:00.000Z'), 10);
    expect(result.toISOString().slice(0, 10)).toBe('2026-11-20');
  });

  it('accepts Saturdays and rejects Sundays as attended dates', () => {
    expect(isAttendedDate(new Date('2026-11-14T00:00:00.000Z'))).toBe(true);
    expect(isAttendedDate(new Date('2026-11-15T00:00:00.000Z'))).toBe(false);
  });

  it('saves a RECIBIDA request of the user, from the web, with its tracking code', async () => {
    const { useCase, save, forUser } = build();

    const result = await useCase.execute(input(validDate()));

    expect(forUser).toHaveBeenCalledWith('user-1');
    const [saved] = save.mock.calls[0];
    expect(saved.status).toBe('RECIBIDA');
    expect(saved.registration).toMatchObject({
      trackingCode: 'SOL-2026-00001',
      requesterId: 'requester-1',
      createdById: 'user-1',
      originChannel: 'WEB',
      reason: 'Consulta de investigación',
      // Without a description, the reason is the description
      requirementDescription: 'Consulta de investigación',
      materialIds: ['material-1'],
    });
    expect(result).toEqual({
      id: saved.id,
      trackingCode: 'SOL-2026-00001',
      status: 'RECIBIDA',
    });
  });

  it('allows a Saturday after the ten-business-day minimum', async () => {
    const { useCase, save } = build();
    const desiredDate = addBusinessDays(todayInBogota(), 10);
    desiredDate.setUTCDate(desiredDate.getUTCDate() + 1);
    while (desiredDate.getUTCDay() !== 6) {
      desiredDate.setUTCDate(desiredDate.getUTCDate() + 1);
    }

    await useCase.execute(input(desiredDate.toISOString().slice(0, 10)));

    expect(save).toHaveBeenCalled();
  });

  it('uses the Bogota date after 19:00 even when UTC is already the next day', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-10T01:00:00.000Z'));

    expect(todayInBogota().toISOString().slice(0, 10)).toBe('2026-11-09');

    const { useCase, save } = build();
    await useCase.execute(input('2026-11-23'));

    expect(save).toHaveBeenCalled();
  });

  it('rejects a date earlier than ten business days before looking anything up', async () => {
    const { useCase, save, forUser } = build();
    const tomorrow = addBusinessDays(todayInBogota(), 1);

    await expect(
      useCase.execute(input(tomorrow.toISOString().slice(0, 10))),
    ).rejects.toBeInstanceOf(DesiredDateError);
    expect(forUser).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('uses a dedicated error when there are no selected materials', async () => {
    const { useCase } = build();

    await expect(
      useCase.execute({ ...input(validDate()), materialIds: [] }),
    ).rejects.toBeInstanceOf(RequestMaterialsRequiredError);
  });

  it('rejects a material that is not in the catalog', async () => {
    const { useCase, save, findMissingMaterialIds } = build();
    findMissingMaterialIds.mockResolvedValue(['material-1']);

    await expect(useCase.execute(input(validDate()))).rejects.toBeInstanceOf(
      RequestMaterialNotFoundError,
    );
    expect(save).not.toHaveBeenCalled();
  });
});
