import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateRoomCapacityDto } from './update-room-capacity.dto';

describe('UpdateRoomCapacityDto', () => {
  it('accepts integers greater than zero', async () => {
    const dto = plainToInstance(UpdateRoomCapacityDto, { dailyCapacity: 15 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([0, -1, 1.5, '15', null, true])(
    'rejects invalid dailyCapacity %p',
    async (dailyCapacity) => {
      const dto = plainToInstance(UpdateRoomCapacityDto, { dailyCapacity });
      expect(await validate(dto)).not.toHaveLength(0);
    },
  );
});
