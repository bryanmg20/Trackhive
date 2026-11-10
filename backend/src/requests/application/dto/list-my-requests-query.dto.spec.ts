import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListMyRequestsQueryDto } from './list-my-requests-query.dto';

// Same options as the global ValidationPipe (app.setup.ts)
const check = async (plain: Record<string, unknown>) =>
  validate(plainToInstance(ListMyRequestsQueryDto, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('ListMyRequestsQueryDto', () => {
  it('accepts an empty query', async () => {
    expect(await check({})).toHaveLength(0);
  });

  it('accepts the status, the order and the page together', async () => {
    const errors = await check({
      status: 'AGENDADA',
      sort: 'desiredDate',
      order: 'asc',
      page: '2',
      limit: '50',
    });

    expect(errors).toHaveLength(0);
  });

  it('turns the page and the limit from the URL into numbers', () => {
    const dto = plainToInstance(ListMyRequestsQueryDto, {
      page: '3',
      limit: '10',
    });

    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(10);
  });

  it.each([
    ['status', 'ROTA'],
    ['sort', 'status'],
    ['order', 'up'],
    ['page', '0'],
    ['limit', '101'],
  ])('rejects %s = %s', async (field, value) => {
    const errors = await check({ [field]: value });

    expect(errors.map((error) => error.property)).toContain(field);
  });

  it.each(['requester', 'material', 'desiredFrom', 'desiredTo'])(
    'does not accept the staff filter %s',
    async (field) => {
      const errors = await check({ [field]: 'x' });

      expect(errors.map((error) => error.property)).toContain(field);
    },
  );
});
