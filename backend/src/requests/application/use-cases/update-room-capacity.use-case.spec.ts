import { InvalidRoomCapacityError } from '../../domain/errors/invalid-room-capacity.error';
import type { IRoomCapacityRepository } from '../../domain/repositories/room-capacity.repository';
import { UpdateRoomCapacityUseCase } from './update-room-capacity.use-case';

describe('UpdateRoomCapacityUseCase', () => {
  let saveDailyCapacity: jest.Mock;
  let useCase: UpdateRoomCapacityUseCase;

  beforeEach(() => {
    saveDailyCapacity = jest.fn();
    const repository: IRoomCapacityRepository = {
      getConfig: jest.fn(),
      saveDailyCapacity,
    };
    useCase = new UpdateRoomCapacityUseCase(repository);
  });

  it('validates, saves and maps the updated capacity', async () => {
    const updatedAt = new Date('2026-11-18T03:00:00.000Z');
    saveDailyCapacity.mockResolvedValue({
      dailyCapacity: 25,
      isDefault: false,
      updatedAt,
      updatedBy: {
        id: 'admin-1',
        firstName: 'Admin',
        middleName: null,
        lastName: 'Demo',
        secondLastName: null,
      },
    });

    const result = await useCase.execute({
      dailyCapacity: 25,
      userId: 'admin-1',
    });

    expect(saveDailyCapacity).toHaveBeenCalledWith(25, 'admin-1');
    expect(result).toEqual({
      dailyCapacity: 25,
      isDefault: false,
      updatedAt: updatedAt.toISOString(),
      updatedBy: { id: 'admin-1', name: 'Admin Demo' },
    });
  });

  it.each([0, -3, 2.5])(
    'rejects invalid capacity %s before saving',
    async (dailyCapacity) => {
      await expect(
        useCase.execute({ dailyCapacity, userId: 'admin-1' }),
      ).rejects.toThrow(InvalidRoomCapacityError);
      expect(saveDailyCapacity).not.toHaveBeenCalled();
    },
  );
});
