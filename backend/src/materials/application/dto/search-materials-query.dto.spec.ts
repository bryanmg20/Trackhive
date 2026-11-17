import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_PAGE_LIMIT } from '../../../common/pagination';
import { SearchMaterialsQueryDto } from './search-materials-query.dto';

const check = async (plain: Record<string, unknown>) =>
  validate(plainToInstance(SearchMaterialsQueryDto, plain));

describe('SearchMaterialsQueryDto', () => {
  it('accepts an empty query', async () => {
    expect(await check({})).toHaveLength(0);
  });

  it('accepts every filter together', async () => {
    const errors = await check({
      q: 'cabildo',
      type: 'DOCUMENTO',
      collection: 'Actas del Cabildo',
      status: 'DISPONIBLE',
      sort: 'catalogCode',
      order: 'desc',
      page: '2',
      limit: String(MAX_PAGE_LIMIT),
    });

    expect(errors).toHaveLength(0);
  });

  it('converts page and limit to numbers', () => {
    const dto = plainToInstance(SearchMaterialsQueryDto, {
      page: '3',
      limit: '10',
    });

    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(10);
  });

  it.each([
    ['type', 'MAPA'],
    ['status', 'ROTO'],
    ['sort', 'status'],
    ['order', 'up'],
    ['page', '0'],
    ['page', '1.5'],
    ['limit', '0'],
    ['limit', String(MAX_PAGE_LIMIT + 1)],
    ['q', 'a'.repeat(101)],
    ['q', 42],
    ['collection', 'a'.repeat(121)],
  ])('rejects %s = %s', async (field, value) => {
    const errors = await check({ [field]: value });

    expect(errors.map((error) => error.property)).toContain(field);
  });

  it('accepts text at the maximum length', async () => {
    const errors = await check({
      q: 'a'.repeat(100),
      collection: 'a'.repeat(120),
    });

    expect(errors).toHaveLength(0);
  });

  it('treats empty text as no filter and trims the rest', async () => {
    const dto = plainToInstance(SearchMaterialsQueryDto, {
      q: '   ',
      collection: '  Actas del Cabildo  ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.q).toBeUndefined();
    expect(dto.collection).toBe('Actas del Cabildo');
  });
});
