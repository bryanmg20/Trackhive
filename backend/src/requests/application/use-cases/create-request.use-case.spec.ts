import {
  addBusinessDays,
  isAttendedDate,
  todayInBogota,
} from '../../domain/desired-date';
import { DesiredDateError } from '../../domain/errors/desired-date-invalid.error';
import { RequestMaterialsRequiredError } from '../../domain/errors/request-materials-required.error';
import { CreateRequestUseCase } from './create-request.use-case';

const buildRepository = () => ({
  create: jest.fn().mockResolvedValue({
    id: 'request-1',
    trackingCode: 'SOL-2026-00001',
    status: 'RECIBIDA',
  }),
  createOnBehalf: jest.fn(),
  findRequesterByEmail: jest.fn(),
});

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

  it('allows a Saturday after the ten-business-day minimum', async () => {
    const repository = buildRepository();
    const useCase = new CreateRequestUseCase(repository);
    const desiredDate = addBusinessDays(todayInBogota(), 10);
    desiredDate.setUTCDate(desiredDate.getUTCDate() + 1);
    while (desiredDate.getUTCDay() !== 6) {
      desiredDate.setUTCDate(desiredDate.getUTCDate() + 1);
    }

    await useCase.execute(
      {
        materialIds: ['material-1'],
        reason: 'Consulta de investigación',
        desiredDate: desiredDate.toISOString().slice(0, 10),
        deliveryMode: 'PRESENCIAL',
      },
      'user-1',
    );

    expect(repository.create).toHaveBeenCalled();
  });

  it('uses the Bogota date after 19:00 even when UTC is already the next day', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-10T01:00:00.000Z'));

    expect(todayInBogota().toISOString().slice(0, 10)).toBe('2026-11-09');

    const repository = buildRepository();
    const useCase = new CreateRequestUseCase(repository);

    await useCase.execute(
      {
        materialIds: ['material-1'],
        reason: 'Consulta de investigación',
        desiredDate: '2026-11-23',
        deliveryMode: 'PRESENCIAL',
      },
      'user-1',
    );

    expect(repository.create).toHaveBeenCalled();
  });

  it('rejects a date earlier than ten business days', async () => {
    const repository = buildRepository();
    const useCase = new CreateRequestUseCase(repository);
    const tomorrow = addBusinessDays(todayInBogota(), 1);

    await expect(
      useCase.execute(
        {
          materialIds: ['material-1'],
          reason: 'Consulta de investigación',
          desiredDate: tomorrow.toISOString().slice(0, 10),
          deliveryMode: 'PRESENCIAL',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(DesiredDateError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('uses a dedicated error when there are no selected materials', async () => {
    const useCase = new CreateRequestUseCase(buildRepository());
    const desiredDate = addBusinessDays(todayInBogota(), 10);

    await expect(
      useCase.execute(
        {
          materialIds: [],
          reason: 'Consulta de investigación',
          desiredDate: desiredDate.toISOString().slice(0, 10),
          deliveryMode: 'PRESENCIAL',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(RequestMaterialsRequiredError);
  });
});
