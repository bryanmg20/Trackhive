import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MostRequestedMaterialsQueryDto } from './most-requested-materials-query.dto';

const errorsOf = async (query: Record<string, unknown>) =>
  validate(plainToInstance(MostRequestedMaterialsQueryDto, query));

describe('MostRequestedMaterialsQueryDto', () => {
  it('accepts no filters at all', async () => {
    expect(await errorsOf({})).toHaveLength(0);
  });

  it('accepts a date range and a limit sent as text', async () => {
    const dto = plainToInstance(MostRequestedMaterialsQueryDto, {
      from: '2026-11-01',
      to: '2026-11-30',
      limit: '25',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.limit).toBe(25);
  });

  it('treats blank dates as no filter', async () => {
    const dto = plainToInstance(MostRequestedMaterialsQueryDto, {
      from: '  ',
      to: '',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.from).toBeUndefined();
    expect(dto.to).toBeUndefined();
  });

  it('rejects malformed dates', async () => {
    expect(await errorsOf({ from: '2026-11-31' })).not.toHaveLength(0);
    expect(await errorsOf({ to: '30/11/2026' })).not.toHaveLength(0);
  });

  it('rejects a limit out of range or not an integer', async () => {
    expect(await errorsOf({ limit: '0' })).not.toHaveLength(0);
    expect(await errorsOf({ limit: '51' })).not.toHaveLength(0);
    expect(await errorsOf({ limit: '2.5' })).not.toHaveLength(0);
  });
});
