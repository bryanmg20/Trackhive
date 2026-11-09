import { DesiredDateError } from '../../domain/errors/desired-date-invalid.error';
import {
  addBusinessDays,
  CreateRequestUseCase,
} from './create-request.use-case';

describe('CreateRequestUseCase', () => {
  it('adds ten weekdays without counting weekends', () => {
    const result = addBusinessDays(new Date('2026-11-06T00:00:00.000Z'), 10);
    expect(result.toISOString().slice(0, 10)).toBe('2026-11-20');
  });

  it('rejects a date earlier than ten business days', async () => {
    const repository = {
      create: jest.fn(),
    };
    const useCase = new CreateRequestUseCase(repository);
    const tomorrow = addBusinessDays(new Date(), 1);

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
});
