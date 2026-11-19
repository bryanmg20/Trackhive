import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_PAGE_LIMIT } from '../../../common/pagination';
import { MaterialHistoryQueryDto } from './material-history-query.dto';

const check = (plain: Record<string, unknown>) =>
  validate(plainToInstance(MaterialHistoryQueryDto, plain));

describe('MaterialHistoryQueryDto', () => {
  it('accepts empty and valid pagination parameters', async () => {
    expect(await check({})).toHaveLength(0);
    expect(await check({ page: '2', limit: '10' })).toHaveLength(0);
  });

  it('rejects invalid page and limit values', async () => {
    expect((await check({ page: '0' })).map((e) => e.property)).toContain(
      'page',
    );
    expect(
      (await check({ limit: String(MAX_PAGE_LIMIT + 1) })).map(
        (e) => e.property,
      ),
    ).toContain('limit');
  });
});
