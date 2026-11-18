import { InvalidAppointmentDateError } from '../../domain/errors/invalid-appointment-date.error';
import type { IRoomCapacityRepository } from '../../domain/repositories/room-capacity.repository';
import type { IRequestQueryService } from '../ports/request-query.port';
import { GetRoomOccupancyUseCase } from './get-room-occupancy.use-case';

describe('GetRoomOccupancyUseCase', () => {
  it('returns daily occupancy and available slots across the requested range', async () => {
    const repository: IRoomCapacityRepository = {
      getConfig: jest.fn().mockResolvedValue({
        dailyCapacity: 10,
        isDefault: false,
        updatedAt: new Date('2026-11-18T00:00:00Z'),
        updatedBy: null,
      }),
      saveDailyCapacity: jest.fn(),
    };
    const countActiveAppointmentsByDateRange = jest.fn().mockResolvedValue([
      { date: '2026-11-19', occupied: 10 },
      { date: '2026-11-20', occupied: 12 },
    ]);
    const queries = {
      countActiveAppointmentsByDateRange,
    } as unknown as IRequestQueryService;

    const useCase = new GetRoomOccupancyUseCase(repository, queries);
    const result = await useCase.execute({
      from: '2026-11-18',
      to: '2026-11-20',
    });

    expect(countActiveAppointmentsByDateRange).toHaveBeenCalledWith(
      new Date('2026-11-18T00:00:00Z'),
      new Date('2026-11-20T00:00:00Z'),
    );
    expect(result).toEqual({
      dailyCapacity: 10,
      days: [
        { date: '2026-11-18', occupied: 0, available: 10, isFull: false },
        { date: '2026-11-19', occupied: 10, available: 0, isFull: true },
        { date: '2026-11-20', occupied: 12, available: 0, isFull: true },
      ],
    });
  });

  it('rejects an invalid date range', async () => {
    const useCase = new GetRoomOccupancyUseCase(
      { getConfig: jest.fn(), saveDailyCapacity: jest.fn() },
      {} as IRequestQueryService,
    );

    await expect(
      useCase.execute({ from: '2026-11-21', to: '2026-11-20' }),
    ).rejects.toThrow(InvalidAppointmentDateError);
  });
});
