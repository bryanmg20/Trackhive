import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetRoomOccupancyQueryDto } from './get-room-occupancy-query.dto';

describe('GetRoomOccupancyQueryDto', () => {
  it('accepts valid YYYY-MM-DD bounds', async () => {
    const dto = plainToInstance(GetRoomOccupancyQueryDto, {
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects malformed or missing dates', async () => {
    const dto = plainToInstance(GetRoomOccupancyQueryDto, {
      from: '2026-11-31',
      to: '11/30/2026',
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
