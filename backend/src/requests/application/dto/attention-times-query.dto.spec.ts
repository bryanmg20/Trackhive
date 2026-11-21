import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AttentionTimesQueryDto } from './attention-times-query.dto';

describe('AttentionTimesQueryDto', () => {
  it('accepts optional, blank and valid date-only filters', async () => {
    for (const value of [
      {},
      { from: '', to: ' ' },
      { from: '2026-11-01', to: '2026-11-30' },
    ]) {
      expect(
        await validate(plainToInstance(AttentionTimesQueryDto, value)),
      ).toHaveLength(0);
    }
  });
  it.each([
    '2026-02-30',
    '20/11/2026',
    '2026-11-20T00:00:00Z',
    ['2026-11-20'],
    5,
  ])('rejects an invalid date %j', async (from) => {
    expect(
      await validate(plainToInstance(AttentionTimesQueryDto, { from })),
    ).not.toHaveLength(0);
  });
});
