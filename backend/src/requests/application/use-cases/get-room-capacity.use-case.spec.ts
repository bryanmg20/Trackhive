import type { IRoomCapacityRepository } from '../../domain/repositories/room-capacity.repository';
import { GetRoomCapacityUseCase } from './get-room-capacity.use-case';

describe('GetRoomCapacityUseCase', () => {
  it('returns the default capacity when no setting is saved', async () => {
    const repository: IRoomCapacityRepository = {
      getConfig: jest.fn().mockResolvedValue({
        dailyCapacity: 15,
        isDefault: true,
        updatedAt: null,
        updatedBy: null,
      }),
      saveDailyCapacity: jest.fn(),
    };
    const useCase = new GetRoomCapacityUseCase(repository);

    await expect(useCase.execute()).resolves.toEqual({
      dailyCapacity: 15,
      isDefault: true,
      updatedAt: null,
      updatedBy: null,
    });
  });

  it('maps the saved capacity and updater full name', async () => {
    const updatedAt = new Date('2026-11-18T03:00:00.000Z');
    const repository: IRoomCapacityRepository = {
      getConfig: jest.fn().mockResolvedValue({
        dailyCapacity: 22,
        isDefault: false,
        updatedAt,
        updatedBy: {
          id: 'admin-1',
          firstName: 'Admin',
          middleName: null,
          lastName: 'Demo',
          secondLastName: null,
        },
      }),
      saveDailyCapacity: jest.fn(),
    };
    const useCase = new GetRoomCapacityUseCase(repository);

    await expect(useCase.execute()).resolves.toEqual({
      dailyCapacity: 22,
      isDefault: false,
      updatedAt: updatedAt.toISOString(),
      updatedBy: { id: 'admin-1', name: 'Admin Demo' },
    });
  });
});
