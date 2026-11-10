import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListRequestsQueryDto } from './list-requests-query.dto';

const check = async (plain: Record<string, unknown>) =>
  validate(plainToInstance(ListRequestsQueryDto, plain));

describe('ListRequestsQueryDto', () => {
  it('accepts an empty query', async () => {
    expect(await check({})).toHaveLength(0);
  });

  it('accepts every filter together', async () => {
    const errors = await check({
      status: 'EN_BUSQUEDA',
      desiredFrom: '2026-12-01',
      desiredTo: '2026-12-31',
      requester: 'juan',
      material: 'cabildo',
      sort: 'desiredDate',
      order: 'asc',
      page: '2',
      limit: '50',
    });

    expect(errors).toHaveLength(0);
  });

  it.each([
    ['status', 'ROTA'],
    ['desiredFrom', '01/12/2026'],
    ['desiredFrom', '2026-13-45'],
    ['desiredTo', '2026-12-01T10:00:00Z'],
    ['sort', 'status'],
    ['order', 'up'],
    ['page', '0'],
    ['limit', '101'],
    ['requester', 'a'.repeat(101)],
    ['material', 'a'.repeat(101)],
  ])('rejects %s = %s', async (field, value) => {
    const errors = await check({ [field]: value });

    expect(errors.map((error) => error.property)).toContain(field);
  });

  it('treats empty text as no filter', async () => {
    const dto = plainToInstance(ListRequestsQueryDto, {
      requester: '   ',
      desiredFrom: '',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.requester).toBeUndefined();
    expect(dto.desiredFrom).toBeUndefined();
  });
});
